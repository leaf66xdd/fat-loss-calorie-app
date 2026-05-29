import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "app.sqlite");
const pgConnectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "";
const appUserId = String(process.env.APP_USER_ID || "default");

let sqliteDb = null;
let pgPool = null;

export const storageProvider = pgConnectionString ? "supabase" : "sqlite";

export async function initDb() {
  if (storageProvider === "supabase") {
    await initPostgres();
    return;
  }

  initSqlite();
}

export async function getProfile() {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query("SELECT * FROM profiles WHERE user_id = $1", [appUserId]);
    return rows[0] ? mapProfile(rows[0]) : null;
  }

  const row = getSqliteDb().prepare("SELECT * FROM profiles WHERE id = 1").get();
  return row ? mapProfile(row) : null;
}

export async function saveProfile(input) {
  if (storageProvider === "supabase") {
    await pgPool.query(
      `
        INSERT INTO profiles (
          user_id, gender, age, height_cm, current_weight_kg, target_weight_kg,
          activity_level, bmr, tdee, calorie_target, start_date, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT(user_id) DO UPDATE SET
          gender = EXCLUDED.gender,
          age = EXCLUDED.age,
          height_cm = EXCLUDED.height_cm,
          current_weight_kg = EXCLUDED.current_weight_kg,
          target_weight_kg = EXCLUDED.target_weight_kg,
          activity_level = EXCLUDED.activity_level,
          bmr = EXCLUDED.bmr,
          tdee = EXCLUDED.tdee,
          calorie_target = EXCLUDED.calorie_target,
          start_date = COALESCE(profiles.start_date, EXCLUDED.start_date),
          updated_at = NOW()
      `,
      [
        appUserId,
        input.gender,
        input.age,
        input.heightCm,
        input.currentWeightKg,
        input.targetWeightKg,
        input.activityLevel,
        input.bmr,
        input.tdee,
        input.calorieTarget,
        input.startDate ?? null
      ]
    );

    return getProfile();
  }

  getSqliteDb()
    .prepare(
      `
        INSERT INTO profiles (
          id, gender, age, height_cm, current_weight_kg, target_weight_kg,
          activity_level, bmr, tdee, calorie_target, start_date, updated_at
        )
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          gender = excluded.gender,
          age = excluded.age,
          height_cm = excluded.height_cm,
          current_weight_kg = excluded.current_weight_kg,
          target_weight_kg = excluded.target_weight_kg,
          activity_level = excluded.activity_level,
          bmr = excluded.bmr,
          tdee = excluded.tdee,
          calorie_target = excluded.calorie_target,
          start_date = COALESCE(profiles.start_date, excluded.start_date),
          updated_at = datetime('now')
      `
    )
    .run(
      input.gender,
      input.age,
      input.heightCm,
      input.currentWeightKg,
      input.targetWeightKg,
      input.activityLevel,
      input.bmr,
      input.tdee,
      input.calorieTarget,
      input.startDate ?? null
    );

  return getProfile();
}

export async function updateProfileTargets(input) {
  if (storageProvider === "supabase") {
    await pgPool.query(
      `
        UPDATE profiles
        SET current_weight_kg = $2,
            bmr = $3,
            tdee = $4,
            calorie_target = $5,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      [appUserId, input.currentWeightKg, input.bmr, input.tdee, input.calorieTarget]
    );

    return getProfile();
  }

  getSqliteDb()
    .prepare(
      `
        UPDATE profiles
        SET current_weight_kg = ?,
            bmr = ?,
            tdee = ?,
            calorie_target = ?,
            updated_at = datetime('now')
        WHERE id = 1
      `
    )
    .run(input.currentWeightKg, input.bmr, input.tdee, input.calorieTarget);

  return getProfile();
}

export async function addMealEntry(input) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      `
        INSERT INTO meal_entries (
          user_id, date, name, weight_g, calories, protein, carbs, fat, items_json, image_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        RETURNING *
      `,
      [
        appUserId,
        input.date,
        input.name,
        input.weightG,
        input.calories,
        input.protein ?? 0,
        input.carbs ?? 0,
        input.fat ?? 0,
        JSON.stringify(input.items ?? []),
        input.imageName ?? null
      ]
    );

    return mapMeal(rows[0]);
  }

  const result = getSqliteDb()
    .prepare(
      `
        INSERT INTO meal_entries (
          date, name, weight_g, calories, protein, carbs, fat, items_json, image_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.date,
      input.name,
      input.weightG,
      input.calories,
      input.protein ?? 0,
      input.carbs ?? 0,
      input.fat ?? 0,
      JSON.stringify(input.items ?? []),
      input.imageName ?? null
    );

  return getMealEntry(Number(result.lastInsertRowid));
}

export async function getMealEntry(id) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query("SELECT * FROM meal_entries WHERE user_id = $1 AND id = $2", [
      appUserId,
      id
    ]);
    return rows[0] ? mapMeal(rows[0]) : null;
  }

  const row = getSqliteDb().prepare("SELECT * FROM meal_entries WHERE id = ?").get(id);
  return row ? mapMeal(row) : null;
}

export async function getMealsByDate(date) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      `
        SELECT *
        FROM meal_entries
        WHERE user_id = $1 AND date = $2
        ORDER BY created_at ASC, id ASC
      `,
      [appUserId, date]
    );
    return rows.map(mapMeal);
  }

  return getSqliteDb()
    .prepare("SELECT * FROM meal_entries WHERE date = ? ORDER BY created_at ASC, id ASC")
    .all(date)
    .map(mapMeal);
}

export async function getHistory(limit = 30) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      `
        SELECT
          meal_entries.date,
          SUM(meal_entries.calories) AS total_calories,
          daily_targets.calorie_target AS target_calories
        FROM meal_entries
        LEFT JOIN daily_targets
          ON daily_targets.user_id = meal_entries.user_id
         AND daily_targets.date = meal_entries.date
        WHERE meal_entries.user_id = $1
        GROUP BY meal_entries.date, daily_targets.calorie_target
        ORDER BY meal_entries.date DESC
        LIMIT $2
      `,
      [appUserId, limit]
    );
    return rows.map((row) => ({
      date: row.date,
      totalCalories: Number(row.total_calories || 0),
      targetCalories: row.target_calories == null ? null : Number(row.target_calories)
    }));
  }

  return getSqliteDb()
    .prepare(
      `
        SELECT
          meal_entries.date,
          SUM(meal_entries.calories) AS total_calories,
          daily_targets.calorie_target AS target_calories
        FROM meal_entries
        LEFT JOIN daily_targets ON daily_targets.date = meal_entries.date
        GROUP BY meal_entries.date, daily_targets.calorie_target
        ORDER BY meal_entries.date DESC
        LIMIT ?
      `
    )
    .all(limit)
    .map((row) => ({
      date: row.date,
      totalCalories: Number(row.total_calories || 0),
      targetCalories: row.target_calories == null ? null : Number(row.target_calories)
    }));
}

export async function upsertDailyTarget(input) {
  if (storageProvider === "supabase") {
    await pgPool.query(
      `
        INSERT INTO daily_targets (user_id, date, bmr, tdee, calorie_target, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT(user_id, date) DO UPDATE SET
          bmr = EXCLUDED.bmr,
          tdee = EXCLUDED.tdee,
          calorie_target = EXCLUDED.calorie_target,
          updated_at = NOW()
      `,
      [appUserId, input.date, input.bmr, input.tdee, input.calorieTarget]
    );
    return;
  }

  getSqliteDb()
    .prepare(
      `
        INSERT INTO daily_targets (date, bmr, tdee, calorie_target, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
          bmr = excluded.bmr,
          tdee = excluded.tdee,
          calorie_target = excluded.calorie_target,
          updated_at = datetime('now')
      `
    )
    .run(input.date, input.bmr, input.tdee, input.calorieTarget);
}

export async function upsertWeightEntry(input) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      `
        INSERT INTO weight_entries (user_id, date, weight_kg, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT(user_id, date) DO UPDATE SET
          weight_kg = EXCLUDED.weight_kg,
          updated_at = NOW()
        RETURNING date, weight_kg
      `,
      [appUserId, input.date, input.weightKg]
    );
    return mapWeight(rows[0]);
  }

  getSqliteDb()
    .prepare(
      `
        INSERT INTO weight_entries (date, weight_kg, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(date) DO UPDATE SET
          weight_kg = excluded.weight_kg,
          updated_at = datetime('now')
      `
    )
    .run(input.date, input.weightKg);

  return getWeightByDate(input.date);
}

export async function getWeightByDate(date) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      "SELECT date, weight_kg FROM weight_entries WHERE user_id = $1 AND date = $2",
      [appUserId, date]
    );
    return rows[0] ? mapWeight(rows[0]) : null;
  }

  const row = getSqliteDb().prepare("SELECT date, weight_kg FROM weight_entries WHERE date = ?").get(date);
  return row ? mapWeight(row) : null;
}

export async function getRecentWeights(limit = 7) {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      `
        SELECT date, weight_kg
        FROM weight_entries
        WHERE user_id = $1
        ORDER BY date DESC
        LIMIT $2
      `,
      [appUserId, limit]
    );
    return rows.reverse().map(mapWeight);
  }

  return getSqliteDb()
    .prepare("SELECT date, weight_kg FROM weight_entries ORDER BY date DESC LIMIT ?")
    .all(limit)
    .reverse()
    .map(mapWeight);
}

export async function getDistinctMealDates() {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      "SELECT DISTINCT date FROM meal_entries WHERE user_id = $1 ORDER BY date DESC",
      [appUserId]
    );
    return rows.map((row) => row.date);
  }

  return getSqliteDb()
    .prepare("SELECT DISTINCT date FROM meal_entries ORDER BY date DESC")
    .all()
    .map((row) => row.date);
}

export async function getDistinctWeightDates() {
  if (storageProvider === "supabase") {
    const { rows } = await pgPool.query(
      "SELECT DISTINCT date FROM weight_entries WHERE user_id = $1 ORDER BY date DESC",
      [appUserId]
    );
    return rows.map((row) => row.date);
  }

  return getSqliteDb()
    .prepare("SELECT DISTINCT date FROM weight_entries ORDER BY date DESC")
    .all()
    .map((row) => row.date);
}

async function initPostgres() {
  pgPool = new Pool({
    connectionString: pgConnectionString,
    ssl: shouldUseSsl(pgConnectionString) ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DATABASE_POOL_SIZE || 5)
  });

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      gender TEXT NOT NULL,
      age INTEGER NOT NULL,
      height_cm NUMERIC NOT NULL,
      current_weight_kg NUMERIC NOT NULL,
      target_weight_kg NUMERIC NOT NULL,
      activity_level TEXT NOT NULL,
      bmr INTEGER NOT NULL,
      tdee INTEGER NOT NULL,
      calorie_target INTEGER NOT NULL,
      start_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meal_entries (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      weight_g NUMERIC NOT NULL,
      calories INTEGER NOT NULL,
      protein NUMERIC NOT NULL DEFAULT 0,
      carbs NUMERIC NOT NULL DEFAULT 0,
      fat NUMERIC NOT NULL DEFAULT 0,
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      image_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_meal_entries_user_date
      ON meal_entries(user_id, date);

    CREATE TABLE IF NOT EXISTS weight_entries (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      weight_kg NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date
      ON weight_entries(user_id, date);

    CREATE TABLE IF NOT EXISTS daily_targets (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      bmr INTEGER NOT NULL,
      tdee INTEGER NOT NULL,
      calorie_target INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_targets_user_date
      ON daily_targets(user_id, date);
  `);
}

function initSqlite() {
  fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      gender TEXT NOT NULL,
      age INTEGER NOT NULL,
      height_cm REAL NOT NULL,
      current_weight_kg REAL NOT NULL,
      target_weight_kg REAL NOT NULL,
      activity_level TEXT NOT NULL,
      bmr INTEGER NOT NULL,
      tdee INTEGER NOT NULL,
      calorie_target INTEGER NOT NULL,
      start_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      weight_g REAL NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL DEFAULT '[]',
      image_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meal_entries_date ON meal_entries(date);

    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight_kg REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(date);

    CREATE TABLE IF NOT EXISTS daily_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      bmr INTEGER NOT NULL,
      tdee INTEGER NOT NULL,
      calorie_target INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_daily_targets_date ON daily_targets(date);
  `);

  try {
    sqliteDb.exec("ALTER TABLE profiles ADD COLUMN start_date TEXT");
  } catch (error) {
    if (!String(error.message || "").includes("duplicate column")) {
      throw error;
    }
  }
}

function getSqliteDb() {
  if (!sqliteDb) {
    initSqlite();
  }
  return sqliteDb;
}

function shouldUseSsl(connectionString) {
  return !/localhost|127\.0\.0\.1/i.test(connectionString);
}

function mapProfile(row) {
  return {
    gender: row.gender,
    age: Number(row.age),
    heightCm: Number(row.height_cm),
    currentWeightKg: Number(row.current_weight_kg),
    targetWeightKg: Number(row.target_weight_kg),
    activityLevel: row.activity_level,
    bmr: Number(row.bmr),
    tdee: Number(row.tdee),
    calorieTarget: Number(row.calorie_target),
    startDate: row.start_date || String(row.created_at || "").slice(0, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMeal(row) {
  return {
    id: Number(row.id),
    date: row.date,
    name: row.name,
    weightG: Number(row.weight_g),
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    items: safeParseItems(row.items_json),
    imageName: row.image_name,
    createdAt: row.created_at
  };
}

function mapWeight(row) {
  return {
    date: row.date,
    weightKg: Number(row.weight_kg)
  };
}

function safeParseItems(value) {
  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}
