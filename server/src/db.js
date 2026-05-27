import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "app.sqlite");

export const db = new DatabaseSync(dbPath);

db.exec(`
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
`);

export function getProfile() {
  const row = db.prepare("SELECT * FROM profiles WHERE id = 1").get();
  return row ? mapProfile(row) : null;
}

export function saveProfile(input) {
  db.prepare(`
    INSERT INTO profiles (
      id, gender, age, height_cm, current_weight_kg, target_weight_kg,
      activity_level, bmr, tdee, calorie_target, updated_at
    )
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      updated_at = datetime('now')
  `).run(
    input.gender,
    input.age,
    input.heightCm,
    input.currentWeightKg,
    input.targetWeightKg,
    input.activityLevel,
    input.bmr,
    input.tdee,
    input.calorieTarget
  );

  return getProfile();
}

export function updateProfileTargets(input) {
  db.prepare(`
    UPDATE profiles
    SET
      current_weight_kg = ?,
      bmr = ?,
      tdee = ?,
      calorie_target = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(input.currentWeightKg, input.bmr, input.tdee, input.calorieTarget);

  return getProfile();
}

export function addMealEntry(input) {
  const result = db.prepare(`
    INSERT INTO meal_entries (
      date, name, weight_g, calories, protein, carbs, fat, items_json, image_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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

export function getMealEntry(id) {
  const row = db.prepare("SELECT * FROM meal_entries WHERE id = ?").get(id);
  return row ? mapMeal(row) : null;
}

export function getMealsByDate(date) {
  return db
    .prepare("SELECT * FROM meal_entries WHERE date = ? ORDER BY created_at ASC, id ASC")
    .all(date)
    .map(mapMeal);
}

export function getHistory(limit = 30) {
  return db
    .prepare(`
      SELECT date, SUM(calories) AS total_calories
      FROM meal_entries
      GROUP BY date
      ORDER BY date DESC
      LIMIT ?
    `)
    .all(limit)
    .map((row) => ({
      date: row.date,
      totalCalories: Number(row.total_calories || 0)
    }));
}

export function upsertWeightEntry(input) {
  db.prepare(`
    INSERT INTO weight_entries (date, weight_kg, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(date) DO UPDATE SET
      weight_kg = excluded.weight_kg,
      updated_at = datetime('now')
  `).run(input.date, input.weightKg);

  return db
    .prepare("SELECT * FROM weight_entries WHERE date = ?")
    .get(input.date);
}

export function getWeightByDate(date) {
  const row = db.prepare("SELECT date, weight_kg FROM weight_entries WHERE date = ?").get(date);
  return row
    ? {
        date: row.date,
        weightKg: Number(row.weight_kg)
      }
    : null;
}

export function getRecentWeights(limit = 7) {
  return db
    .prepare("SELECT date, weight_kg FROM weight_entries ORDER BY date DESC LIMIT ?")
    .all(limit)
    .reverse()
    .map((row) => ({
      date: row.date,
      weightKg: Number(row.weight_kg)
    }));
}

export function getDistinctMealDates() {
  return db
    .prepare("SELECT DISTINCT date FROM meal_entries ORDER BY date DESC")
    .all()
    .map((row) => row.date);
}

export function getDistinctWeightDates() {
  return db
    .prepare("SELECT DISTINCT date FROM weight_entries ORDER BY date DESC")
    .all()
    .map((row) => row.date);
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

function safeParseItems(value) {
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}
