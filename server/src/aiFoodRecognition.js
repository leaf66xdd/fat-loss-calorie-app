import { normalizeRecognizedItems } from "./domain.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ARK_CHAT_COMPLETIONS_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

const FOOD_RECOGNITION_PROMPT =
  "你是一个中国减脂热量记录 App 的食物识别助手。请根据图片识别食物，估算重量、热量和三大营养素。" +
  "优先识别中国常见食物、食堂餐盘、外卖、包装食品和方便面。包装食品如果看得到包装或营养成分表，优先按包装信息估算。" +
  "如果图片不清楚或无法确定，不要硬猜成水果等无关食物；请返回“待确认食物”，热量填 0，confidence 低于 0.4，并提示用户手动修正。" +
  "只返回 JSON，不要 Markdown。格式：{\"items\":[{\"name\":\"方便面\",\"amount\":\"1桶\",\"weightG\":110,\"calories\":520,\"protein\":10,\"carbs\":67,\"fat\":24,\"confidence\":0.75}],\"message\":\"...\"}。" +
  "所有数值使用数字，热量单位 kcal，重量单位 g。";

export async function analyzeFoodWithAI(file) {
  if (!file?.buffer?.length) {
    return null;
  }

  const imageUrl = `data:${file.mimetype || "image/jpeg"};base64,${file.buffer.toString("base64")}`;
  const providers = getVisionProviders();

  if (!providers.length) {
    return null;
  }

  const errors = [];
  for (const provider of providers) {
    try {
      if (provider.kind === "chat-completions") {
        return await analyzeWithChatCompletions(provider, imageUrl);
      }

      return await analyzeWithOpenAIResponses(provider, imageUrl);
    } catch (error) {
      errors.push(`${provider.label}: ${error.message}`);
    }
  }

  throw new Error(errors.join("；") || "AI 识别暂时不可用");
}

function getVisionProviders() {
  const providers = [];
  const arkKey = process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY;
  const arkModel = process.env.ARK_VISION_MODEL || process.env.DOUBAO_VISION_MODEL;
  const customKey = process.env.VISION_API_KEY;
  const customBaseUrl = process.env.VISION_BASE_URL;
  const customModel = process.env.VISION_MODEL;
  const openAIKey = process.env.OPENAI_API_KEY;

  if (arkKey && arkModel) {
    providers.push({
      kind: "chat-completions",
      label: "doubao",
      apiKey: arkKey,
      model: arkModel,
      url: normalizeChatCompletionsUrl(process.env.ARK_BASE_URL || ARK_CHAT_COMPLETIONS_URL)
    });
  }

  if (customKey && customBaseUrl && customModel) {
    providers.push({
      kind: "chat-completions",
      label: process.env.VISION_PROVIDER_NAME || "vision",
      apiKey: customKey,
      model: customModel,
      url: normalizeChatCompletionsUrl(customBaseUrl)
    });
  }

  if (openAIKey) {
    providers.push({
      kind: "openai-responses",
      label: "openai",
      apiKey: openAIKey,
      model: process.env.OPENAI_VISION_MODEL || DEFAULT_OPENAI_MODEL
    });
  }

  return providers;
}

function normalizeChatCompletionsUrl(url) {
  const value = String(url || "").replace(/\/$/, "");
  if (value.endsWith("/chat/completions")) {
    return value;
  }
  return `${value}/chat/completions`;
}

async function analyzeWithChatCompletions(provider, imageUrl) {
  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: FOOD_RECOGNITION_PROMPT
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "国内视觉模型识别暂时不可用";
    throw new Error(message);
  }

  return buildRecognitionResult(extractChatCompletionText(payload), provider.label);
}

async function analyzeWithOpenAIResponses(provider, imageUrl) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.1,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: FOOD_RECOGNITION_PROMPT
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

  return buildRecognitionResult(extractOutputText(payload), provider.label);
}

function buildRecognitionResult(text, provider) {
  const parsed = parseJsonObject(text);
  const result = normalizeRecognizedItems(parsed.items);
  result.message =
    parsed.message ||
    "AI 已识别图片内容，但热量仍是估算值。请根据包装或实际份量修正。";
  result.confidence = averageConfidence(result.items);
  result.needsReview = result.confidence < 0.7;
  result.provider = provider;
  return result;
}

function extractChatCompletionText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
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
