async function request(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }

  return payload;
}

export function getToday() {
  return request("/api/today");
}

export function createProfile(data) {
  return request("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function analyzeFoodImage(file, hint = "") {
  const body = new FormData();
  if (file) {
    body.append("image", file);
  }
  if (hint) {
    body.append("hint", hint);
  }

  return request("/api/food/analyze", {
    method: "POST",
    body
  });
}

export function saveMeal(data) {
  return request("/api/meals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function getHistory() {
  return request("/api/history?limit=30");
}

export function getWeights() {
  return request("/api/weights?days=7");
}

export function saveWeight(data) {
  return request("/api/weights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}
