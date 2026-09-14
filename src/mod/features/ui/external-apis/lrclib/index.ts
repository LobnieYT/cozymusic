import { Result, ok, err } from "neverthrow";
import type { LrclibSong } from "./models";

const LRCLIB_API_URL = "https://lrclib.net/api";

export interface LrclibQuery {
  artist: string;
  title: string;
  album?: string;
  durationSec?: number;
}

function hasSynced(song: LrclibSong): boolean {
  return !song.instrumental && !!song.syncedLyrics && song.syncedLyrics.includes("[");
}

async function fetchJson(url: string): Promise<Result<any, string>> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "YandexMusicMod/2.1.3 (https://github.com/LobnieYT/Yandex-Music-Mod)" },
    });
    if (response.status === 404) return err("not_found");
    if (!response.ok) return err(`http_${response.status}`);
    return ok(await response.json());
  } catch (error: any) {
    return err(error?.message ?? "fetch_failed");
  }
}

class LrclibApi {
  async getSyncedLyrics(query: LrclibQuery): Promise<Result<string, string>> {
    const params = new URLSearchParams({
      artist_name: query.artist,
      track_name: query.title,
    });
    if (query.album) params.set("album_name", query.album);
    if (query.durationSec) params.set("duration", String(Math.round(query.durationSec)));

    // 1. Точное совпадение
    const exact = await fetchJson(`${LRCLIB_API_URL}/get?${params.toString()}`);
    if (exact.isOk() && hasSynced(exact.value as LrclibSong)) {
      console.log("[lrclib] exact match:", (exact.value as LrclibSong).artistName, "-", (exact.value as LrclibSong).trackName);
      return ok((exact.value as LrclibSong).syncedLyrics as string);
    }

    // 2. Поиск с выбором лучшего совпадения (есть синхронный текст + близкая длительность)
    const search = await fetchJson(
      `${LRCLIB_API_URL}/search?q=${encodeURIComponent(`${query.artist} ${query.title}`)}`,
    );
    if (search.isErr()) return err(search.error);
    const songs = (search.value ?? []) as LrclibSong[];
    const withSync = songs.filter(hasSynced);
    if (withSync.length === 0) return err("no_synced_lyrics");

    let best = withSync[0]!;
    if (query.durationSec) {
      best = withSync.reduce((a, b) =>
        Math.abs(a.duration - query.durationSec!) <= Math.abs(b.duration - query.durationSec!) ? a : b,
      );
    }
    console.log("[lrclib] search match:", best.artistName, "-", best.trackName);
    return ok(best.syncedLyrics as string);
  }
}

export const lrclibApi = new LrclibApi();
