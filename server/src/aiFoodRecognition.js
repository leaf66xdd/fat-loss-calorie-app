import { normalizeRecognizedItems } from "./domain.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";

export async function analyzeFoodWithAI(file) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !file?.buffer?.length) {
    return null;
  }

  const imageUrl = `data:${file.mimetype || "image/jpeg"};base64,${file.buffer.toString("base64")}`;
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL,
      temperature: 0.1,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "你是一个中国减脂热量记录 App 的食物识别助手。请根据图片识别食物，估算重量和热量。" +
                "如果是包装食品，优先识别品类和包装份量；如果看不清，不要瞎猜，给出低 confidence 并提示用户手动修正。" +
                "只返回 JSON，不要 Markdown。格式：{\"items\":[{\"name\":\"方便面\",\"amount\":\"1桶\",\"weightG\":110,\"calories\":520,\"protein\":10,\"carbs\":67,\"fat\":24,\"confidence\":0.75}],\"message\":\"...\"}。" +
                "所有数值使用数字，热量单位 kcal，重量单位 g。"
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high"
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || "AI 识别暂时不可用";
    throw new Error(message);
  }

  const text = extractOutputText(payload);
  const parsed = parseJsonObject(text);
  const result = normalizeRecognizedItems(parsed.items);
  result.message =
    parsed.message ||
    "AI 已识别图片内容，但热量仍是估算值。请根据包装或实际份量修正。";
  result.confidence = averageConfidence(result.items);
  result.needsReview = result.confidence < 0.7;
  return result;
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const chunks = [];
  for (const output of payload.output || []) {
    for (const content of output.content || []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n");
}

function parseJsonObject(text) {
  const source = String(text || "").trim();
  if (!source) {
    throw new Error("AI 没有返回可解析的识别结果");
  }

  try {
    return JSON.parse(source);
  } catch {
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI 识别结果格式异常");
    }
    return JSON.parse(match[0]);
  }
}

function averageConfidence(items) {
  if (!items.length) {
    return 0;
  }

  const sum = items.reduce((total, item) => total + Number(item.confidence || 0), 0);
  return Math.round((sum / items.length) * 100) / 100;
}
