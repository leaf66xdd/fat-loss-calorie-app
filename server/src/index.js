import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeFoodWithAI } from "./aiFoodRecognition.js";
import {
  addMealEntry,
  getDistinctMealDates,
  getDistinctWeightDates,
  getHistory,
  getMealsByDate,
  getProfile,
  getRecentWeights,
  getWeightByDate,
  saveProfile,
  updateProfileTargets,
  upsertWeightEntry
} from "./db.js";
import {
  asNonNegativeNumber,
  asPositiveNumber,
  buildCalorieNotice,
  calculateDayNumber,
  calculateStreak,
  calculateTargets,
  calculateWeightTrend,
  getDailyQuote,
  getMockFoodRecognition,
  getRemainingFoodSuggestions,
  isDateKey,
  toDateKey
} from "./domain.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/profile", (_req, res) => {
  res.json({ profile: getProfile() });
});

app.post("/api/profile", (req, res) => {
  try {
    const input = readProfileInput(req.body);
    const targets = calculateTargets(input);
    const profile = saveProfile({ ...input, ...targets });

    upsertWeightEntry({
      date: toDateKey(),
      weightKg: input.currentWeightKg
    });

    res.status(201).json({
      profile,
      recommendation: `根据你的身体数据，建议每日摄入约 ${profile.calorieTarget} kcal`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/today", (req, res) => {
  const date = String(req.query.date || toDateKey());
  const profile = getProfile();

  if (!profile) {
    res.json({ profile: null });
    return;
  }

  res.json(buildTodayState(date, profile));
});

app.post("/api/food/analyze", upload.single("image"), async (req, res) => {
  const hint = req.body?.hint || req.file?.originalname || "";

  try {
    const aiRecognition = await analyzeFoodWithAI(req.file);
    if (aiRecognition) {
      res.json({
        source: "openai",
        imageName: req.file?.originalname || null,
        ...aiRecognition
      });
      return;
    }
  } catch (error) {
    console.warn("AI food recognition failed:", error.message);
  }

  const recognition = getMockFoodRecognition(hint);
  res.json({
    source: "manual-review",
    imageName: req.file?.originalname || null,
    ...recognition
  });
});

app.post("/api/meals", (req, res) => {
  try {
    const profile = getProfile();
    if (!profile) {
      res.status(400).json({ error: "请先完成首次设置" });
      return;
    }

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const entry = addMealEntry({
      date: String(req.body.date || toDateKey()),
      name: String(req.body.name || "本餐").trim() || "本餐",
      weightG: asNonNegativeNumber(req.body.weightG ?? 0, "重量"),
      calories: Math.round(asNonNegativeNumber(req.body.calories, "热量")),
      protein: asNonNegativeNumber(req.body.protein ?? 0, "蛋白质"),
      carbs: asNonNegativeNumber(req.body.carbs ?? 0, "碳水"),
      fat: asNonNegativeNumber(req.body.fat ?? 0, "脂肪"),
      items,
      imageName: req.body.imageName || null
    });

    res.status(201).json({
      entry,
      today: buildTodayState(entry.date, profile)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/history", (req, res) => {
  const profile = getProfile();
  const limit = Math.min(Number(req.query.limit || 30), 120);
  const calorieTarget = profile?.calorieTarget || 0;

  const rows = getHistory(limit).map((row) => ({
    ...row,
    target: calorieTarget,
    isOverTarget: calorieTarget > 0 ? row.totalCalories > calorieTarget : false,
    overBy: calorieTarget > 0 ? Math.max(0, row.totalCalories - calorieTarget) : 0
  }));

  res.json({ history: rows });
});

app.get("/api/weights", (req, res) => {
  const limit = Math.min(Number(req.query.days || 7), 30);
  const weights = getRecentWeights(limit);
  res.json({
    weights,
    trend: calculateWeightTrend(weights)
  });
});

app.post("/api/weights", (req, res) => {
  try {
    const profile = getProfile();
    if (!profile) {
      res.status(400).json({ error: "请先完成首次设置" });
      return;
    }

    const date = String(req.body.date || toDateKey());
    const weightKg = asPositiveNumber(req.body.weightKg, "体重");
    const entry = upsertWeightEntry({ date, weightKg });
    const targets = calculateTargets({ ...profile, currentWeightKg: weightKg });
    const updatedProfile = updateProfileTargets({
      ...profile,
      currentWeightKg: weightKg,
      ...targets
    });
    const weights = getRecentWeights(7);

    res.status(201).json({
      entry: {
        date: entry.date,
        weightKg: Number(entry.weight_kg)
      },
      profile: updatedProfile,
      today: buildTodayState(date, updatedProfile),
      weights,
      trend: calculateWeightTrend(weights),
      recommendation: `已根据今天体重重新推算：目标热量约 ${updatedProfile.calorieTarget} kcal`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: "图片过大，请换一张更小的图片" });
    return;
  }

  res.status(500).json({ error: "服务器暂时不可用" });
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});

function buildTodayState(date, profile) {
  const meals = getMealsByDate(date);
  const consumed = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const remaining = profile.calorieTarget - consumed;
  const hour = new Date().getHours();
  const todayWeight = getWeightByDate(date);

  return {
    date,
    profile,
    timeline: {
      startDate: profile.startDate || date,
      dayNumber: calculateDayNumber(profile.startDate || date, date)
    },
    meals,
    totals: {
      target: profile.calorieTarget,
      consumed,
      remaining
    },
    suggestions: getRemainingFoodSuggestions(remaining),
    streaks: {
      calories: calculateStreak(getDistinctMealDates(), toDateKey()),
      weight: calculateStreak(getDistinctWeightDates(), toDateKey())
    },
    weight: {
      hasTodayWeight: Boolean(todayWeight),
      todayWeightKg: todayWeight?.weightKg ?? null
    },
    quote: getDailyQuote(date),
    notice: buildCalorieNotice({
      remaining,
      target: profile.calorieTarget,
      hour
    })
  };
}

function readProfileInput(body) {
  const gender = body.gender === "female" ? "female" : "male";
  const activityLevel = String(body.activityLevel || "");
  const startDate = isDateKey(body.startDate) ? String(body.startDate) : toDateKey();

  return {
    gender,
    age: Math.round(asPositiveNumber(body.age, "年龄")),
    heightCm: asPositiveNumber(body.heightCm, "身高"),
    currentWeightKg: asPositiveNumber(body.currentWeightKg, "当前体重"),
    targetWeightKg: asPositiveNumber(body.targetWeightKg, "目标体重"),
    activityLevel,
    startDate
  };
}
