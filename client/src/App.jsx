import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  History,
  Home,
  Loader2,
  Scale,
  Upload
} from "lucide-react";
import {
  analyzeFoodImage,
  createProfile,
  getHistory,
  getToday,
  getWeights,
  saveMeal,
  saveWeight
} from "./api.js";

const activityOptions = [
  { value: "sedentary", label: "久坐不运动" },
  { value: "light", label: "轻度活动" },
  { value: "moderate", label: "中度活动" },
  { value: "high", label: "高活动量" }
];

const tabs = [
  { key: "home", label: "首页", icon: Home },
  { key: "capture", label: "记录", icon: Camera },
  { key: "weight", label: "体重", icon: Scale },
  { key: "history", label: "历史", icon: History }
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("home");
  const [today, setToday] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [weights, setWeights] = useState({ weights: [], trend: null });
  const [foodDraft, setFoodDraft] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  const hasProfile = Boolean(today?.profile);

  async function refreshAll() {
    const todayData = await getToday();
    setToday(todayData);
    setError("");

    if (todayData.profile) {
      await refreshSecondaryData();
    }
  }

  async function refreshSecondaryData() {
    const [historyResult, weightResult] = await Promise.allSettled([getHistory(), getWeights()]);

    if (historyResult.status === "fulfilled") {
      setHistoryRows(historyResult.value.history);
    } else {
      console.warn("Failed to refresh history", historyResult.reason);
    }

    if (weightResult.status === "fulfilled") {
      setWeights(weightResult.value);
    } else {
      console.warn("Failed to refresh weights", weightResult.reason);
    }
  }

  useEffect(() => {
    refreshAll()
      .catch((err) => setError(err.message))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleProfileCreated() {
    setError("");
    await refreshAll();
    setTab("home");
  }

  async function handleFoodAnalyzed(result, file) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setFoodDraft({
      source: result.source,
      imageName: result.imageName,
      message: result.message,
      items: result.items.map((item) => ({ ...item }))
    });
    setTab("capture");
  }

  async function handleMealSaved(payload) {
    setToday(payload.today);
    setFoodDraft(null);
    setPreviewUrl("");
    setError("");
    await refreshSecondaryData();
    setTab("home");
  }

  async function handleWeightSaved(payload) {
    if (payload.today) {
      setToday(payload.today);
    } else {
      setToday(await getToday());
    }

    setError("");
    await refreshSecondaryData();
  }

  if (booting) {
    return <LoadingScreen />;
  }

  if (!hasProfile) {
    return (
      <Shell>
        <Onboarding onDone={handleProfileCreated} error={error} setError={setError} />
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="safe-bottom min-h-screen px-5 pb-28 pt-5">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {tab === "home" ? (
          <HomeView
            today={today}
            onCapture={() => setTab("capture")}
            onWeightSaved={handleWeightSaved}
            setError={setError}
          />
        ) : null}

        {tab === "capture" ? (
          <CaptureView
            today={today}
            draft={foodDraft}
            previewUrl={previewUrl}
            onAnalyzed={handleFoodAnalyzed}
            onDraftChange={setFoodDraft}
            onSaved={handleMealSaved}
            setError={setError}
          />
        ) : null}

        {tab === "weight" ? (
          <WeightView
            today={today}
            weights={weights}
            onSaved={handleWeightSaved}
            setError={setError}
          />
        ) : null}

        {tab === "history" ? <HistoryView rows={historyRows} /> : null}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <div className="mx-auto min-h-screen w-full max-w-md bg-white shadow-soft sm:my-6 sm:min-h-[860px] sm:overflow-hidden sm:rounded-[28px] sm:border sm:border-zinc-100">
        {children}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <Shell>
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
      </div>
    </Shell>
  );
}

function Onboarding({ onDone, error, setError }) {
  const [form, setForm] = useState({
    gender: "male",
    age: 24,
    heightCm: 177,
    currentWeightKg: 82,
    targetWeightKg: 75,
    activityLevel: "sedentary"
  });
  const [saving, setSaving] = useState(false);
  const [recommendation, setRecommendation] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await createProfile(form);
      setRecommendation(result.recommendation);
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <main className="min-h-screen px-5 pb-8 pt-8">
      <div className="mb-7">
        <p className="text-sm font-medium text-zinc-500">首次设置</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
          自动算出今天该吃多少
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          填一次身体数据，之后直接记录食物。
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {recommendation ? (
        <div className="mb-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
          {recommendation}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={submit}>
        <SegmentedControl
          label="性别"
          value={form.gender}
          options={[
            { value: "male", label: "男" },
            { value: "female", label: "女" }
          ]}
          onChange={(value) => update("gender", value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="年龄" value={form.age} suffix="岁" onChange={(value) => update("age", value)} />
          <NumberField
            label="身高"
            value={form.heightCm}
            suffix="cm"
            onChange={(value) => update("heightCm", value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="当前体重"
            value={form.currentWeightKg}
            suffix="kg"
            step="0.1"
            onChange={(value) => update("currentWeightKg", value)}
          />
          <NumberField
            label="目标体重"
            value={form.targetWeightKg}
            suffix="kg"
            step="0.1"
            onChange={(value) => update("targetWeightKg", value)}
          />
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-600">日常活动水平</span>
          <select
            className="h-12 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base outline-none transition focus:border-zinc-900"
            value={form.activityLevel}
            onChange={(event) => update("activityLevel", event.target.value)}
          >
            {activityOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="tap-highlight-none mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-base font-semibold text-white active:scale-[0.99] disabled:bg-zinc-300"
          disabled={saving}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          生成每日热量目标
        </button>
      </form>
    </main>
  );
}

function HomeView({ today, onCapture, onWeightSaved, setError }) {
  const remaining = today.totals.remaining;
  const isOver = remaining < 0;
  const calorieGap = Math.max(0, today.profile.tdee - today.totals.target);

  return (
    <div>
      <header className="pb-5">
        <p className="text-lg font-semibold leading-8 text-zinc-950">{today.quote}</p>
      </header>

      <section className="border-b border-zinc-100 pb-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">今日剩余</p>
            <div className={isOver ? "mt-2 text-6xl font-semibold text-red-500" : "mt-2 text-6xl font-semibold text-zinc-950"}>
              {Math.abs(remaining)}
            </div>
          </div>
          <span className="pb-3 text-base font-medium text-zinc-500">kcal</span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">{isOver ? "已超出目标" : "还可以吃"}</p>
      </section>

      <section className="border-b border-zinc-100 py-5">
        <div className="mb-4 flex items-end justify-between border-b border-zinc-100 pb-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">维持热量</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{today.profile.tdee}</p>
            <p className="mt-1 text-xs font-medium text-zinc-400">不增不减大约吃这么多</p>
          </div>
          <span className="pb-1 text-xs font-medium text-zinc-400">kcal</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Metric label="减脂目标热量" value={today.totals.target} helper={`比维持少 ${calorieGap} kcal`} />
          <Metric label="今日已摄入" value={today.totals.consumed} />
        </div>
      </section>

      <DailyWeightCheck today={today} onSaved={onWeightSaved} setError={setError} />

      <section className="border-b border-zinc-100 py-5">
        <button
          type="button"
          className="tap-highlight-none flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-zinc-950 text-lg font-semibold text-white active:scale-[0.99]"
          onClick={onCapture}
        >
          <Camera className="h-6 w-6" />
          拍照记录食物
        </button>
      </section>

      <section className="border-b border-zinc-100 py-5">
        <div className="grid grid-cols-2 gap-3">
          <StreakItem icon={Flame} label="已连续记录热量" value={`${today.streaks.calories} 天`} />
          <StreakItem icon={Clock3} label="已连续记录体重" value={`${today.streaks.weight} 天`} />
        </div>
      </section>

      {today.notice ? (
        <section className="border-b border-zinc-100 py-5">
          <div className="rounded-lg border border-zinc-200 px-4 py-3">
            <p className={today.notice.type === "over" ? "font-semibold text-red-500" : "font-semibold text-zinc-950"}>
              {today.notice.title}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{today.notice.body}</p>
          </div>
        </section>
      ) : null}

      <section className="py-5">
        <h2 className="text-base font-semibold text-zinc-950">你今天还可以吃：</h2>
        <div className="mt-3 space-y-2">
          {today.suggestions.map((item) => (
            <div key={item} className="flex items-center justify-between border-b border-zinc-100 py-3 last:border-b-0">
              <span className="text-base text-zinc-800">{item}</span>
              <ChevronRight className="h-4 w-4 text-zinc-300" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DailyWeightCheck({ today, onSaved, setError }) {
  const [weightKg, setWeightKg] = useState(today.weight?.todayWeightKg || today.profile.currentWeightKg);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWeightKg(today.weight?.todayWeightKg || today.profile.currentWeightKg);
  }, [today.weight?.todayWeightKg, today.profile.currentWeightKg]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = await saveWeight({ date: today.date, weightKg });
      await onSaved(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (today.weight?.hasTodayWeight) {
    return (
      <section className="border-b border-zinc-100 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">今日体重</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">
              {Number(today.weight.todayWeightKg).toFixed(1)} kg
            </p>
          </div>
          <p className="max-w-[8rem] text-right text-xs leading-5 text-zinc-500">已用于校准今日目标热量</p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-zinc-100 py-5">
      <form onSubmit={submit}>
        <div className="mb-3">
          <p className="text-base font-semibold text-zinc-950">输入今日体重</p>
          <p className="mt-1 text-sm text-zinc-500">保存后自动重新推算目标热量。</p>
        </div>
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <NumberField
              label="体重"
              value={weightKg}
              suffix="kg"
              step="0.1"
              onChange={setWeightKg}
            />
          </div>
          <button
            type="submit"
            className="tap-highlight-none mt-7 flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-semibold text-white active:scale-[0.99] disabled:bg-zinc-300"
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CaptureView({ today, draft, previewUrl, onAnalyzed, onDraftChange, onSaved, setError }) {
  const fileInputRef = useRef(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    if (!draft?.items?.length) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, weightG: 0 };
    }

    return draft.items.reduce(
      (sum, item) => ({
        calories: sum.calories + Number(item.calories || 0),
        protein: sum.protein + Number(item.protein || 0),
        carbs: sum.carbs + Number(item.carbs || 0),
        fat: sum.fat + Number(item.fat || 0),
        weightG: sum.weightG + Number(item.weightG || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, weightG: 0 }
    );
  }, [draft]);

  async function analyze(file) {
    setAnalyzing(true);
    setError("");

    try {
      const result = await analyzeFoodImage(file, file ? file.name : "示例");
      await onAnalyzed(result, file);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(index, field, value) {
    onDraftChange((current) => {
      const items = current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      );
      return { ...current, items };
    });
  }

  async function confirmMeal() {
    if (!draft?.items?.length) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = await saveMeal({
        date: today.date,
        name: draft.items.map((item) => item.name).join(" + "),
        weightG: Math.round(totals.weightG),
        calories: Math.round(totals.calories),
        protein: roundOne(totals.protein),
        carbs: roundOne(totals.carbs),
        fat: roundOne(totals.fat),
        imageName: draft.imageName,
        items: draft.items
      });
      await onSaved(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="pb-5">
        <p className="text-sm font-medium text-zinc-500">食物记录</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">拍一下，确认后扣热量</h1>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            analyze(file);
          }
          event.target.value = "";
        }}
      />

      {!draft ? (
        <section className="space-y-3">
          <button
            type="button"
            className="tap-highlight-none flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-zinc-950 text-lg font-semibold text-white active:scale-[0.99]"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            上传或拍摄食物图片
          </button>
          <button
            type="button"
            className="tap-highlight-none flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 text-base font-semibold text-zinc-800 active:scale-[0.99]"
            onClick={() => analyze(null)}
            disabled={analyzing}
          >
            <Upload className="h-5 w-5" />
            使用示例识别
          </button>
        </section>
      ) : (
        <section>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="食物预览"
              className="mb-5 h-52 w-full rounded-2xl object-cover"
            />
          ) : null}

          <div className="mb-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            {draft.message || "热量为估算值，请根据实际情况调整。"}
          </div>

          <div className="border-y border-zinc-100 py-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">本餐估算</p>
                <p className="mt-1 text-5xl font-semibold text-zinc-950">{Math.round(totals.calories)}</p>
              </div>
              <span className="pb-2 text-base font-medium text-zinc-500">kcal</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Macro label="蛋白质" value={`${roundOne(totals.protein)}g`} />
              <Macro label="碳水" value={`${roundOne(totals.carbs)}g`} />
              <Macro label="脂肪" value={`${roundOne(totals.fat)}g`} />
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {draft.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="py-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-500">食物名称</span>
                  <input
                    className="h-12 w-full rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-900"
                    value={item.name}
                    onChange={(event) => updateItem(index, "name", event.target.value)}
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    label="重量"
                    value={item.weightG}
                    suffix="g"
                    onChange={(value) => updateItem(index, "weightG", value)}
                  />
                  <NumberField
                    label="热量"
                    value={item.calories}
                    suffix="kcal"
                    onChange={(value) => updateItem(index, "calories", value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-24 mt-5 bg-white pt-2">
            <button
              type="button"
              className="tap-highlight-none flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-base font-semibold text-white active:scale-[0.99] disabled:bg-zinc-300"
              onClick={confirmMeal}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              确认记录
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function WeightView({ today, weights, onSaved, setError }) {
  const [weightKg, setWeightKg] = useState(today.profile.currentWeightKg);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWeightKg(today.profile.currentWeightKg);
  }, [today.profile.currentWeightKg]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = await saveWeight({ date: today.date, weightKg });
      await onSaved(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const trend = weights.trend;

  return (
    <div>
      <header className="pb-5">
        <p className="text-sm font-medium text-zinc-500">体重趋势</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          {trend?.currentWeightKg ? `当前体重：${trend.currentWeightKg.toFixed(1)} kg` : "记录今天体重"}
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          {trend?.label || "看最近 7 天，不看单日波动。"}
        </p>
      </header>

      <form className="border-y border-zinc-100 py-5" onSubmit={submit}>
        <NumberField
          label="今日体重"
          value={weightKg}
          suffix="kg"
          step="0.1"
          onChange={setWeightKg}
        />
        <button
          type="submit"
          className="tap-highlight-none mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 text-base font-semibold text-white active:scale-[0.99] disabled:bg-zinc-300"
          disabled={saving}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          保存体重
        </button>
      </form>

      <section className="py-5">
        <SimpleLineChart rows={weights.weights} />
      </section>

      <section className="divide-y divide-zinc-100">
        {weights.weights.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">暂无体重记录</p>
        ) : (
          weights.weights
            .slice()
            .reverse()
            .map((row) => (
              <div key={row.date} className="flex items-center justify-between py-4">
                <span className="text-sm text-zinc-500">{formatDate(row.date)}</span>
                <span className="text-base font-semibold text-zinc-900">{row.weightKg.toFixed(1)} kg</span>
              </div>
            ))
        )}
      </section>
    </div>
  );
}

function HistoryView({ rows }) {
  return (
    <div>
      <header className="pb-5">
        <p className="text-sm font-medium text-zinc-500">历史记录</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">只看每天是否稳住</h1>
      </header>

      <section className="divide-y divide-zinc-100">
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">暂无热量记录</p>
        ) : (
          rows.map((row) => (
            <div key={row.date} className="flex items-center justify-between py-4">
              <div>
                <p className="text-base font-semibold text-zinc-950">{formatDate(row.date)}</p>
                <p className="mt-1 text-sm text-zinc-500">{row.totalCalories} kcal</p>
              </div>
              <span
                className={
                  row.isOverTarget
                    ? "rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-500"
                    : "rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600"
                }
              >
                {row.isOverTarget ? `超出 ${row.overBy} kcal` : "未超标"}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-zinc-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={
                isActive
                  ? "tap-highlight-none flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-zinc-950"
                  : "tap-highlight-none flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-zinc-400"
              }
              onClick={() => onChange(tab.key)}
              aria-label={tab.label}
              title={tab.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Metric({ label, value, helper }) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs font-medium text-zinc-400">{helper || "kcal"}</p>
    </div>
  );
}

function StreakItem({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-3">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function Macro({ label, value }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2 py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function NumberField({ label, value, onChange, suffix, step = "1" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-600">{label}</span>
      <div className="flex h-12 items-center rounded-lg border border-zinc-200 bg-white px-3 transition focus-within:border-zinc-900">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <span className="ml-2 shrink-0 text-sm font-medium text-zinc-400">{suffix}</span>
      </div>
    </label>
  );
}

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-600">{label}</p>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              value === option.value
                ? "tap-highlight-none h-10 rounded-lg bg-white text-sm font-semibold text-zinc-950 shadow-sm"
                : "tap-highlight-none h-10 rounded-lg text-sm font-medium text-zinc-500"
            }
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SimpleLineChart({ rows }) {
  if (rows.length < 2) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 text-sm text-zinc-500">
        记录两天后显示趋势
      </div>
    );
  }

  const width = 320;
  const height = 150;
  const padding = 22;
  const values = rows.map((row) => row.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.8);
  const points = rows.map((row, index) => {
    const x = padding + (index * (width - padding * 2)) / (rows.length - 1);
    const y = height - padding - ((row.weightKg - min) / range) * (height - padding * 2);
    return { x, y, row };
  });

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-2 py-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="最近 7 天体重趋势">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e4e4e7" />
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#18181b"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle key={point.row.date} cx={point.x} cy={point.y} r="4.5" fill="#18181b" />
        ))}
      </svg>
    </div>
  );
}

function formatDate(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function roundOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
