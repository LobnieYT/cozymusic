import { getTrackMeta, getProgress } from "~/mod/features/utils/player";
import { lrclibApi } from "@ui/external-apis/lrclib";
import { musixmatchApi } from "@ui/external-apis/musixmatch";

export const LYRICS_SOURCE_KEY = "lyrics/source";
export type LyricsSource = "yandex" | "lrclib" | "musixmatch";

const LRC_LINE_RE = /^\[(\d+):(\d+(?:\.\d+)?)\]/;

export async function getLyricsSource(): Promise<LyricsSource> {
  try {
    const saved = await window.yandexMusicMod.getStorageValue(LYRICS_SOURCE_KEY);
    if (saved === "lrclib" || saved === "musixmatch" || saved === "yandex") return saved;
  } catch (e) {}
  return "yandex";
}

function toLrcTimestamp(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds - m * 60).toFixed(2).padStart(5, "0");
  return `[${String(m).padStart(2, "0")}:${s}]`;
}

/** LRC/plain -> data: URL (файл текстов едет внутри JSON, отдельных запросов нет) */
export function lyricsToDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:text/plain;charset=utf-8;base64,${btoa(binary)}`;
}

/** LRC -> plain text (для TEXT-режима просмотра текстов) */
export function stripLrcTimestamps(lrc: string): string {
  return lrc
    .split("\n")
    .map((line) => line.replace(/^\[(?:\d+:)?\d+(?:\.\d+)?\]/g, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/** DFXP (musixmatch) -> LRC. Regex-парсинг без зависимости от DOM. */
export function dfxpToLrc(dfxp: string): string | null {
  try {
    const lines: string[] = [];
    const re = /<p\b[^>]*\bbegin="([^"]*)"[^>]*>([\s\S]*?)<\/p\s*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(dfxp)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      if (!text) continue;
      const begin = m[1].trim();
      const t = begin.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
      if (t) {
        const total = (t[1] ? parseInt(t[1], 10) * 60 : 0) + parseFloat(t[2]);
        lines.push(`${toLrcTimestamp(total)}${text}`);
      } else {
        lines.push(`${toLrcTimestamp(0)}${text}`);
      }
    }
    if (lines.length === 0) return null;
    return lines.join("\n") + "\n";
  } catch (e) {
    console.error("[lyrics] dfxp parse failed:", e);
    return null;
  }
}

function pickMeta() {
  const metaResult = getTrackMeta();
  if (metaResult.isErr()) return null;
  const meta = metaResult.value;
  const progressResult = getProgress();
  const durationSec = progressResult.isOk()
    ? progressResult.value.duration
    : typeof meta.durationMs === "number"
      ? meta.durationMs / 1000
      : undefined;
  const title = [meta.title, meta.version].filter(Boolean).join(" ").trim();
  const artist = meta.artists?.[0]?.name;
  if (!title || !artist) return null;
  return { title, artist, album: meta.albums?.[0]?.title, durationSec, trackId: meta.id };
}

async function fetchMusixmatchLrc(meta: NonNullable<ReturnType<typeof pickMeta>>): Promise<string | null> {
  try {
    const bridge = (window as any).yandexMusicMod;
    if (!bridge?.axios) return null;
    const configResult = await musixmatchApi.getAllMetaRequest(meta.title, meta.artist, meta.durationSec);
    if (configResult.isErr()) return null;
    const response = await bridge.axios(configResult.value);
    if (!response?.success || response?.data?.message?.header?.status_code !== 200) return null;
    const macroCalls = response.data.message?.body?.macro_calls ?? {};
    const subCall = macroCalls["track.subtitles.get"];
    const list = subCall?.message?.body?.subtitle_list;
    const body: string | undefined = Array.isArray(list) ? list[0]?.subtitle?.subtitle_body : undefined;
    if (!body) return null;
    return dfxpToLrc(body);
  } catch (e) {
    console.error("[lyrics] musixmatch failed:", e);
    return null;
  }
}

const lrcCache = new Map<string | number, string>();

export async function fetchExternalLrc(): Promise<string | null> {
  const source = await getLyricsSource();
  if (source === "yandex") return null;

  const meta = pickMeta();
  if (!meta) return null;
  if (lrcCache.has(meta.trackId)) return lrcCache.get(meta.trackId)!;

  let lrc: string | null = null;
  if (source === "lrclib") {
    const result = await lrclibApi.getSyncedLyrics({
      artist: meta.artist,
      title: meta.title,
      album: meta.album,
      durationSec: meta.durationSec,
    });
    if (result.isOk()) lrc = result.value;
    else console.log("[lyrics] lrclib miss:", result.error);
  } else if (source === "musixmatch") {
    lrc = await fetchMusixmatchLrc(meta);
  }

  if (lrc) {
    lrcCache.set(meta.trackId, lrc);
    if (lrcCache.size > 30) lrcCache.delete(lrcCache.keys().next().value!);
  }
  return lrc;
}
