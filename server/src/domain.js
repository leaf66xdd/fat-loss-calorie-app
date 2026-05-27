export const activityOptions = {
  sedentary: { label: "久坐不运动", factor: 1.2, deficit: 400 },
  light: { label: "轻度活动", factor: 1.375, deficit: 450 },
  moderate: { label: "中度活动", factor: 1.55, deficit: 500 },
  high: { label: "高活动量", factor: 1.725, deficit: 600 }
};

const dailyQuotes = [
  "你还想不想谈对象？",
  "瘦下来真的会不一样。",
  "别让情绪替你吃饭。",
  "你不是没能力，你是总断。",
  "今天控制住，明天就会感谢自己。",
  "你离好状态，可能只差坚持一个月。",
  "别又三天热血。",
  "真正拉开差距的是连续性。",
  "晚上这一口，可能就是你减脂失败的原因。",
  "别把今天交给嘴馋。",
  "稳定，比狠更有用。",
  "这一顿别乱，今天就稳了。"
];

const mockFoodSets = [
  [
    food("方便面", "1 桶", 110, 520, 10, 67, 24)
  ],
  [
    food("荞麦面", "1 包", 90, 320, 12, 62, 2),
    food("水煮蛋", "2 个", 100, 144, 13, 1, 10),
    food("青菜", "150g", 150, 35, 3, 6, 0)
  ],
  [
    food("米饭", "200g", 200, 232, 5, 52, 1),
    food("鸡胸肉", "150g", 150, 248, 46, 0, 5),
    food("西兰花", "120g", 120, 40, 4, 7, 0)
  ],
  [
    food("全麦面包", "2 片", 70, 175, 7, 32, 3),
    food("无糖酸奶", "1 杯", 180, 115, 7, 10, 4),
    food("香蕉", "1 根", 120, 105, 1, 27, 0)
  ]
];

export function calculateTargets(input) {
  const activity = activityOptions[input.activityLevel];
  if (!activity) {
    throw new Error("请选择有效的活动水平");
  }

  const genderOffset = input.gender === "female" ? -161 : 5;
  const bmr = Math.round(
    10 * input.currentWeightKg + 6.25 * input.heightCm - 5 * input.age + genderOffset
  );
  const tdee = Math.round(bmr * activity.factor);
  const rawTarget = tdee - activity.deficit;
  const minTarget = Math.round(bmr * 0.95);
  const safeTarget = Math.max(rawTarget, minTarget);
  const calorieTarget = Math.max(roundToNearest100(safeTarget), roundUpToNearest100(minTarget));

  return {
    bmr,
    tdee,
    calorieTarget,
    activityLabel: activity.label,
    deficit: tdee - calorieTarget
  };
}

export function getRemainingFoodSuggestions(remaining) {
  if (remaining < 0) {
    return [
      "黄瓜",
      "小番茄",
      "无糖酸奶半杯",
      "水煮蛋 1 个",
      "海带汤",
      "魔芋结",
      "生菜 + 鸡胸肉几片"
    ];
  }

  if (remaining <= 120) {
    return [
      "一个小苹果",
      "一杯无糖酸奶",
      "黄瓜 + 水煮蛋半个",
      "小番茄一盒",
      "鸡蛋 1 个",
      "紫菜蛋花汤",
      "豆腐 100g"
    ];
  }

  if (remaining <= 280) {
    return [
      "两个鸡蛋",
      "牛奶 + 香蕉半根",
      "一小碗燕麦",
      "玉米半根 + 鸡蛋",
      "红薯 100g + 无糖酸奶",
      "鸡胸肉 100g",
      "豆腐 150g + 青菜"
    ];
  }

  if (remaining <= 520) {
    return [
      "一包荞麦面",
      "鸡胸肉 200g",
      "米饭 150g + 青菜",
      "红薯 200g + 牛奶",
      "虾仁 200g + 西兰花",
      "牛肉 120g + 玉米半根",
      "豆腐 200g + 鸡蛋 + 青菜"
    ];
  }

  return [
    "鸡胸肉 150g + 米饭 200g",
    "荞麦面 + 两个鸡蛋",
    "牛肉 150g + 红薯 200g",
    "虾仁 200g + 米饭 150g",
    "鸡腿去皮 + 玉米 + 青菜",
    "番茄牛肉汤 + 米饭 150g",
    "全麦三明治 + 无糖酸奶"
  ];
}

export function getDailyQuote(dateKey) {
  const seed = [...dateKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return dailyQuotes[seed % dailyQuotes.length];
}

export function getMockFoodRecognition(hint = "") {
  const normalized = String(hint).trim();
  if (/方便面|泡面|拉面|instant|noodle/i.test(normalized)) {
    return summarizeFoodSet(mockFoodSets[0], "当前为模拟识别：请确认是不是方便面，并按包装热量修改。");
  }
  if (/饭|米|盖浇|便当/.test(normalized)) {
    return summarizeFoodSet(mockFoodSets[2]);
  }
  if (/面包|酸奶|香蕉|早餐/.test(normalized)) {
    return summarizeFoodSet(mockFoodSets[3]);
  }

  return summarizeFoodSet(
    [food("待确认食物", "请修改", 0, 0, 0, 0, 0)],
    "当前拍照识别是模拟接口，不能仅凭图片保证准确。请用下方常见食物快速修正，或手动修改名称、重量和热量。"
  );
}

export function buildCalorieNotice({ remaining, target, hour }) {
  if (remaining < 0) {
    return {
      type: "over",
      title: `今天已超出约 ${Math.abs(remaining)} kcal`,
      body: "今晚建议避免高热量夜宵。"
    };
  }

  if (hour >= 22 && remaining <= Math.max(150, target * 0.12)) {
    return {
      type: "night",
      title: "今天热量已经接近目标",
      body: "如果饿，可以选择低热量食物。"
    };
  }

  return null;
}

export function calculateWeightTrend(rows) {
  if (rows.length === 0) {
    return {
      currentWeightKg: null,
      changeKg: null,
      label: "今天还没有记录体重"
    };
  }

  const first = rows[0].weightKg;
  const last = rows[rows.length - 1].weightKg;
  const changeKg = roundOne(last - first);
  let label = "最近 7 天整体稳定";

  if (changeKg <= -0.2) {
    label = `最近 7 天：↓ ${Math.abs(changeKg).toFixed(1)} kg`;
  } else if (changeKg >= 0.2) {
    label = "体重会正常波动，请关注长期趋势。";
  }

  return {
    currentWeightKg: last,
    changeKg,
    label
  };
}

export function calculateStreak(dates, todayKey) {
  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = todayKey;

  while (dateSet.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}

export function toDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function shiftDate(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function calculateDayNumber(startDate, todayKey) {
  if (!isDateKey(startDate) || !isDateKey(todayKey)) {
    return 1;
  }

  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const startMs = Date.UTC(startYear, startMonth - 1, startDay);
  const todayMs = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const diffDays = Math.floor((todayMs - startMs) / 86400000);
  return Math.max(1, diffDays + 1);
}

export function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function asPositiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} 必须大于 0`);
  }
  return number;
}

export function asNonNegativeNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${fieldName} 不能小于 0`);
  }
  return number;
}

export function normalizeRecognizedItems(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const normalized = safeItems
    .map((item) => ({
      name: String(item.name || "待确认食物").trim() || "待确认食物",
      amount: String(item.amount || item.weight || "").trim(),
      weightG: Math.max(0, Math.round(Number(item.weightG ?? item.weight_g ?? item.grams ?? 0) || 0)),
      calories: Math.max(0, Math.round(Number(item.calories ?? item.kcal ?? 0) || 0)),
      protein: Math.max(0, roundOne(Number(item.protein ?? 0) || 0)),
      carbs: Math.max(0, roundOne(Number(item.carbs ?? item.carbohydrate ?? 0) || 0)),
      fat: Math.max(0, roundOne(Number(item.fat ?? 0) || 0)),
      confidence: clamp(Number(item.confidence ?? 0.5) || 0.5, 0, 1)
    }))
    .slice(0, 6);

  return summarizeFoodSet(
    normalized.length ? normalized : [food("待确认食物", "请修改", 0, 0, 0, 0, 0)],
    "AI 已尽量识别食物，但热量仍是估算值。包装食品建议按营养成分表修正。"
  );
}

function food(name, amount, weightG, calories, protein, carbs, fat) {
  return { name, amount, weightG, calories, protein, carbs, fat };
}

function summarizeFoodSet(items, message = "热量为估算值，请根据实际情况调整。") {
  const totals = items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
      weightG: sum.weightG + item.weightG
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, weightG: 0 }
  );

  return {
    items,
    totals: {
      calories: Math.round(totals.calories),
      protein: roundOne(totals.protein),
      carbs: roundOne(totals.carbs),
      fat: roundOne(totals.fat),
      weightG: Math.round(totals.weightG)
    },
    message
  };
}

function roundToNearest100(value) {
  return Math.round(value / 100) * 100;
}

function roundUpToNearest100(value) {
  return Math.ceil(value / 100) * 100;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
