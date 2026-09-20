import { onYandexApiResponse, onYandexApiRequest } from "~/mod/features/utils/utils";
import { getTrackUrl, getTracksInfo, QualityEnum } from "~/mod/features/utils/api";
import { musixmatchApi } from "@ui/external-apis/musixmatch";
import { type Lyrics, type Subtitle } from "@ui/external-apis/musixmatch/models";
import { toast } from "sonner";
import { getLyricsSource } from "~/mod/features/lyrics/lyrics";

// Заменить hasPlus на true, когда яндекс получает информацию о текущем пользователе
onYandexApiResponse("api.music.yandex.net/account/about", async function (response: any) {
  const data = response.data;
  data.hasPlus = true;
  console.log(`[PlusUnlocker] Change hasPlus value:`, data);
  return data;
});

// Убрать рекламу яндекса в виде контента в подборках
onYandexApiResponse("/editorial-promotion", async function (response: any) {
  console.log(`[PlusUnlocker] Remove promotions:`, response.data);
  const result = { promotions: [] };
  return result;
});

// Не знаю, что это, но как то связано с плюсом, так что убрал
onYandexApiResponse("/proxy/plus-red-alert/v1/alerts", async function (response: any) {
  console.log(`[PlusUnlocker] Remove plus-red-alert:`, response.data);
  const result = { alerts: [] };
  return result;
});

// Убрать рекламу из треков
onYandexApiResponse("api.music.yandex.net/get-file-info", async function (response: any) {
  const url: string = response.url;
  const data = response.data;

  const trackId: string | null = new URLSearchParams(url).get("trackId");
  if (!trackId) return data;

  if (data.downloadInfo.trackId === trackId) {
    return data;
  } else {
    const trackData = await getTrackUrl(trackId, data.downloadInfo.quality as QualityEnum);

    if (trackData.isErr()) {
      console.error("[PlusUnlocker] Error getting track url for ad bypass :", trackData.error);
      return data;
    } else {
      console.log(`[PlusUnlocker] Ad bypassed for track ${trackId}`, trackData.value);
      const result = { downloadInfo: trackData.value };
      return result;
    }
  }
});

// Убрать рекламу из обложек треков (разраб яндекса если ты это читаешь - как же ты заморочился паскуда)
onYandexApiResponse("api.music.yandex.net", async (response: any) => {
  function walk(obj: any, cb: (node: any, path: (string | number)[]) => void, path: (string | number)[] = []): void {
    if (obj && typeof obj === "object") {
      if (Array.isArray(obj)) {
        obj.forEach((item: any, idx: number) => walk(item, cb, [...path, idx]));
      } else {
        cb(obj, path);
        Object.values(obj).forEach((value: any) => walk(value, cb, path));
      }
    }
  }

  const source: any = response.data;

  const ids: string[] = [];
  walk(source, (node: any) => {
    if (node && "id" in node && "realId" in node && "coverUri" in node && "ogImage" in node && node.type === "music") {
      ids.push(node.id as string);
    }
  });

  if (ids.length === 0) return source;

  const trackMetaResponse = await getTracksInfo(ids, true);
  if (trackMetaResponse.isErr()) {
    console.error("[PlusUnlocker] Error getting new images:", trackMetaResponse.error);
    return source;
  }

  const trackMetas = trackMetaResponse.value;
  const metaById = new Map<string, any>(trackMetas.map((m: any) => [m.id, m]));

  walk(source, (node: any) => {
    if (node && "id" in node && "realId" in node && "coverUri" in node && "ogImage" in node) {
      const meta = metaById.get(node.id as string);
      if (!meta) return;

      node.coverUri = meta.coverUri;
      node.ogImage = meta.ogImage;
    }
  });

  console.log("[PlusUnlocker] Ads in image bypassed for tracks", ids, source);

  return source;
});

// Убрать блоки донатов артистам
onYandexApiResponse("/donation", async function (response: any) {
  console.log(`[PlusUnlocker] Remove donations`, response);
  return {
    donations: [],
  };
});

// Убрать блоки концертов если блок концертов отключен
onYandexApiResponse("/concerts", async function (response: any) {
  const hiddenMenuItems = (await window.yandexMusicMod.getStorageValue("custom-themes/hideMenuItems")) || [];

  if (hiddenMenuItems.includes("concerts")) {
    console.log(`[PlusUnlocker] Remove concerts`, response);

    return {
      concerts: [],
    };
  }
});

onYandexApiResponse("/rotor/session/", async function (response: any) {
  const url: string = response.url;
  const data = response.data;

  if (url.includes("feedback")) return data;

  const tracks = data.sequence;

  const isAllAds = tracks.every((trackInfo: any) => trackInfo.track && trackInfo.track.title === "Промокод Upgrade");

  data.sequence = tracks.filter((trackInfo: any) => trackInfo.track && trackInfo.track.title !== "Промокод Upgrade");
  console.log(`[PlusUnlocker] Remove all ads from session:`, data);

  if (isAllAds) {
    toast.error("Моя Волна больше не работает", {
      description:
        "Яндекс выдал вашему аккаунту теневой бан. Вы все еще сможете слушать треки в плейлистах и через поиск, но для получения рекомендаций нужно будет создать новый аккаунт и перенести треки туда, такая функция есть в моде.",
      icon: null,
    });
  }

  return data;
});

// Автоматически нажать на кнопку входа чтобы не смущать пользователя сообщением о том, что необходим плюс
setInterval(function (): void {
  const loginButton: HTMLButtonElement | null = window.document.querySelector(
    'button[class*="WelcomePage_loginButton__"]',
  ) as HTMLButtonElement | null;
  if (loginButton) loginButton.click();
}, 500);

// Подпись запросов текстов песен под Android-клиент (даёт доступ к синхронным текстам).
// Активно только когда выбран источник "yandex": для lrclib/musixmatch тело ответа
// подменяется в features/lyrics, а подпись яндекса не нужна.
onYandexApiRequest("/lyrics?", async function (request: any) {
  const source = await getLyricsSource();
  if (source !== "yandex") return undefined;

  try {
    request.headers.set("x-yandex-music-client", "YandexMusicAndroid/24023621");
    var url = new URL(request.url);
    var pathSegments = url.pathname.split("/");
    var trackId = pathSegments[2];
    var timestamp = url.searchParams.get("timeStamp");
    var oldSign = url.searchParams.get("sign");
    var newSign = await getLyricsSign(`${trackId}${timestamp}`);
    url.searchParams.set("sign", newSign);

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      mode: request.mode,
      credentials: request.credentials,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
      integrity: request.integrity,
      keepalive: request.keepalive,
      signal: request.signal,
    });

    console.log(`[PlusUnlocker] Patch getLyrics url:`, {
      url: newRequest.url,
      trackId: trackId,
      timestamp: timestamp,
      oldSign: oldSign,
      newSign: newSign,
    });

    return newRequest;
  } catch (e) {
    console.error("[PlusUnlocker] getLyrics sign patch failed, passing through:", e);
    return undefined;
  }
});

async function getLyricsSign(a) {
  let t = "p93jhgh689SBReK6ghtw62"; // секретный ключ для android приложений
  let n: any;
  let i: any;
  ((n = new TextEncoder()), (i = n.encode(t)));
  return crypto.subtle
    .importKey(
      "raw",
      i,
      {
        name: "HMAC",
        hash: {
          name: "SHA-256",
        },
      },
      !0,
      ["sign", "verify"],
    )
    .then(async (e) => {
      let t = n.encode(a);
      return crypto.subtle.sign("HMAC", e, t).then((e) => btoa(String.fromCharCode(...new Uint8Array(e))));
    });
}
