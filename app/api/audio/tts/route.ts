import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/lib/env";
import { getTtsCacheEntry, setTtsCacheEntry } from "@/lib/db";

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Aoede";

async function synthesizeWithGemini(text: string): Promise<Uint8Array> {
  const apiKey = getEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: TTS_VOICE },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData || audioData.length < 1000) {
      throw new Error("No audio data in response");
    }

    const binaryStr = atob(audioData);
    const wavBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      wavBytes[i] = binaryStr.charCodeAt(i);
    }
    return wavBytes;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Gemini TTS error: ${msg}`);
  }
}

export async function POST(req: NextRequest) {
  // AWS: return 503 (Polly TTS requires separate IAM setup and SDK)
  if (process.env.DEPLOY_TARGET === "aws") {
    return NextResponse.json({ error: "TTS not available on AWS (requires Polly setup)" }, { status: 503 });
  }

  let text: string;

  try {
    const body = await req.json() as { text?: unknown };
    if (typeof body.text !== "string" || body.text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    text = body.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text.length > 5000) text = text.slice(0, 5000);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Check server-side DB cache first
  const textHash = await sha256hex(text);
  const cachedBase64 = await getTtsCacheEntry(textHash).catch(() => null);
  if (cachedBase64) {
    const binaryStr = atob(cachedBase64);
    const audioBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) audioBytes[i] = binaryStr.charCodeAt(i);
    return new NextResponse(Buffer.from(audioBytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBytes.byteLength),
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  let audioBytes: Uint8Array;
  try {
    audioBytes = await synthesizeWithGemini(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Store in DB cache (base64 of audio)
  const audioBase64 = btoa(String.fromCharCode(...audioBytes));
  setTtsCacheEntry(textHash, audioBase64, TTS_MODEL, TTS_VOICE).catch(() => {});

  return new NextResponse(Buffer.from(audioBytes), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBytes.byteLength),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
