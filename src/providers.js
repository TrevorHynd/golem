// Provider abstraction. The engine only needs: given a system prompt and a user
// message, return text. Swap providers freely via the PROVIDER env var.

const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  ollama: "llama3",
};

export function resolveProvider(env = process.env) {
  const provider = (env.PROVIDER || "anthropic").toLowerCase();
  const model = env.MODEL || DEFAULT_MODELS[provider];
  const temperature = Number(env.TEMPERATURE ?? 0.9);
  const maxTokens = Number(env.MAX_TOKENS ?? 500);
  if (!model) throw new Error(`Unknown PROVIDER "${provider}"`);
  return { provider, model, temperature, maxTokens };
}

// Returns a callModel(systemPrompt, userMessage) -> Promise<string>
export function makeCallModel(cfg = resolveProvider()) {
  const { provider, model, temperature, maxTokens } = cfg;

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    return async (system, user) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.content[0].text;
    };
  }

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    return async (system, user) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices[0].message.content;
    };
  }

  if (provider === "ollama") {
    const host = process.env.OLLAMA_HOST || "http://localhost:11434";
    return async (system, user) => {
      const res = await fetch(`${host}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          system,
          prompt: user,
          stream: false,
          options: { temperature, num_predict: maxTokens },
        }),
      });
      if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.response;
    };
  }

  throw new Error(`Unsupported provider "${provider}"`);
}

// Strip markdown fences and parse the agent's JSON response.
export function parseResponse(text) {
  const content = String(text)
    .replace(/^```json\s*\n?/i, "")
    .replace(/^```\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  return JSON.parse(content);
}
