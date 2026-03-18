"use client";

import { useRef, useState, useCallback } from "react";
import { useSettings } from "@/lib/settings-context";

// Session-scoped cache: text → Object URL (WAV blob)
const audioCache = new Map<string, string>();

export function useAudio() {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!settings.audioMode) return;
      stop();

      try {
        let objectUrl = audioCache.get(text);

        if (!objectUrl) {
          const res = await fetch("/api/audio/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) return;
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          audioCache.set(text, objectUrl);
        }

        const audio = new Audio(objectUrl);
        audio.playbackRate = settings.audioSpeed;
        audioRef.current = audio;

        audio.addEventListener("ended", () => setPlaying(false));
        audio.addEventListener("error", () => setPlaying(false));

        setPlaying(true);
        await audio.play();
      } catch {
        setPlaying(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.audioMode, settings.audioSpeed],
  );

  return { speak, stop, playing };
}
