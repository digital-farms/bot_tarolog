import "dotenv/config";

const OPENAI_TTS_API_KEY = process.env["OPENAI_TTS_API_KEY"];

if (!OPENAI_TTS_API_KEY) {
  console.error("OPENAI_TTS_API_KEY не задан в .env");
  process.exit(1);
}

export async function generateVoice(text: string): Promise<Buffer> {
  // Убираем HTML-теги — TTS читает чистый текст
  const clean = text.replace(/<[^>]+>/g, "");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_TTS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice: "nova",
      input: clean,
      response_format: "opus",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI TTS error ${res.status}: ${err}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}
