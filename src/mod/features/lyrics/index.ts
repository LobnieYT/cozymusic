import { onYandexApiJsonOverride } from "~/mod/features/utils/utils";
import { fetchExternalLrc, getLyricsSource, stripLrcTimestamps, lyricsToDataUrl } from "./lyrics";

// Подмена текстов песен целиком на уровне JSON getLyrics.
// Клиент ждёт {downloadUrl, major, externalLyricId, lyricId, writers}.
// Без Плюса сервер этот запрос режет — поэтому для сторонних источников ответ
// синтезируем сами, а файл текстов упаковываем в data: URL (отдельных
// сетевых запросов нет, транспорт клиента не важен).
// major/lyricId подобраны под модели клиента (MajorModel{id,number;name;
// prettyName}, lyricId:number); lyricId:0 отключает отправку lyricViews.
onYandexApiJsonOverride("/lyrics", async function ({ url }: any) {
  const match = url.match(/\/tracks\/([^/]+)\/lyrics[^ ]*format=(LRC|TEXT)/);
  if (!match) return undefined;
  const trackId = match[1];

  const source = await getLyricsSource();
  if (source === "yandex") return undefined;

  try {
    const lrc = await fetchExternalLrc();
    if (typeof lrc !== "string" || lrc.length === 0) {
      console.log(`[lyrics] provider ${source} miss for track ${trackId}, passthrough`);
      return undefined;
    }

    const isText = url.includes("format=TEXT");
    const text = isText ? stripLrcTimestamps(lrc) : lrc;

    console.log(`[lyrics] getLyrics synthesized from ${source} for track ${trackId} (${text.length} chars)`);
    return {
      downloadUrl: lyricsToDataUrl(text),
      major: { id: 0, name: "mod", prettyName: "mod" },
      externalLyricId: "mod",
      lyricId: 0,
      writers: [],
    };
  } catch (e) {
    console.error("[lyrics] getLyrics synthesis failed:", e);
    return undefined;
  }
});
