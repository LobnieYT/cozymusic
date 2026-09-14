const YandexApiOnRequestHandlers = [];
const YandexApiOnResponseHandlers = [];
const YandexApiOnTextResponseHandlers = [];
const YandexApiOnJsonOverrideHandlers = [];
const originalFetch = window.fetch;

// отключить попытку отправки аналитики. Она и так заблочена, но без этого будет сыпать ошибками в консоль
navigator.sendBeacon = function (...args) {
  return true;
};

(function () {
  const originalAppendChild = document.head.appendChild;

  document.head.appendChild = function (element) {
    // Проверяем, что это script элемент
    if (element instanceof HTMLScriptElement) {
      const src = element.src || "";

      // Проверяем URL
      if (
        src.includes("https://yandex.ru/ads/system/adsdk.js") ||
        src.includes("https://mc.yandex.ru/metrika/tag.js")
      ) {
        console.log("Заблокирована попытка добавить Yandex скрипт:", src);
        return true; // Возвращаем true как указано в требованиях
      }
    }

    // Для всех остальных элементов используем оригинальный метод
    return originalAppendChild.call(this, element);
  };
})();

export function initFetchInterceptor() {
  window.fetch = function (...args) {
    var request = [...args][0];

    // Нормализация: строковый URL заворачиваем в Request, чтобы ВСЕ запросы
    // шли через перехватчик единообразно (иначе часть вызовов httpClient
    // обходит подмены — например загрузка файла текста с маркерного URL).
    if (typeof request === "string") {
      try {
        request = new Request(request, [...args][1]);
        args = [request];
      } catch (e) {
        return originalFetch(...args);
      }
    }

    // отключить попытку отправки аналитики. Она и так заблочена, но без этого будет сыпать ошибками в консоль
    if (
      request &&
      request.url &&
      (request.url.includes("log.strm.yandex.ru") ||
        request.url.includes("api.music.yandex.net/dynamic-pages/trigger/polling"))
    ) {
      return new Promise((resolve) => resolve(new Response()));
    }

    if (request && request.url && request.url.startsWith("https://api.music.yandex.net"))
      return yandexApiFetch(...args);

    try {
      return originalFetch(...args);
    } catch (e) {}
  };
}

const yandexApiFetch = async function (...args) {
  let [resource, config] = args;

  console.log(`[YandexApiFetch] new request: ${resource.url}`, resource.headers);

  if (YandexApiOnRequestHandlers.find((x) => resource.url.includes(x.url))) {
    for (var i = 0; i < YandexApiOnRequestHandlers.length; i++) {
      if (!resource.url.includes(YandexApiOnRequestHandlers[i].url)) continue;
      try {
        var requestOverride = await YandexApiOnRequestHandlers[i].handler(resource);
      } catch (e) {
        console.error("[YandexApiFetch] request handler failed, passing through:", e);
        continue;
      }
      if (!requestOverride) continue;
      args.resource = requestOverride;
      resource = requestOverride;
    }
  }

  if (YandexApiOnJsonOverrideHandlers.find((x) => resource.url.includes(x.url))) {
    // Синтез JSON-ответа целиком (например тексты песен со стороннего источника).
    // Хендлер может вернуть объект (подмена) или undefined (штатный флоу).
    let upstream = null;
    try {
      upstream = await originalFetch(resource);
    } catch (e) {}
    for (var j = 0; j < YandexApiOnJsonOverrideHandlers.length; j++) {
      if (!resource.url.includes(YandexApiOnJsonOverrideHandlers[j].url)) continue;
      try {
        var jsonOverride = await YandexApiOnJsonOverrideHandlers[j].handler({
          url: resource.url,
          response: upstream,
        });
      } catch (e) {
        console.error("[YandexApiFetch] json override handler failed, passing through:", e);
        continue;
      }
      if (jsonOverride !== undefined) {
        return new Response(JSON.stringify(jsonOverride), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    if (upstream) return upstream;
  }

  if (YandexApiOnTextResponseHandlers.find((x) => resource.url.includes(x.url))) {
    // Текстовые ответы (например файлы текстов песен в LRC) — JSON-парсинг тут невозможен.
    // Маркерные URL мода (mod-lyrics) в сеть не ходят: текст подставляет хендлер.
    let textResp = null;
    let text = "";
    try {
      textResp = await originalFetch(resource);
      text = await textResp.clone().text();
    } catch (e) {}

    let respText = null;

    for (var i = 0; i < YandexApiOnTextResponseHandlers.length; i++) {
      if (!resource.url.includes(YandexApiOnTextResponseHandlers[i].url)) continue;
      try {
        var textOverride = await YandexApiOnTextResponseHandlers[i].handler({
          url: resource.url,
          text: respText ?? text,
        });
      } catch (e) {
        console.error("[YandexApiFetch] text handler failed, passing through:", e);
        continue;
      }
      if (typeof textOverride === "string") respText = textOverride;
    }

    if (typeof respText === "string") {
      return new Response(respText, {
        status: textResp ? textResp.status : 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (textResp) return textResp;
    return originalFetch(resource);
  }

  if (YandexApiOnResponseHandlers.find((x) => resource.url.includes(x.url))) {
    const response = await originalFetch(resource);
    const clonedResponse = response.clone();
    const data = await clonedResponse.json();

    let resp = data;

    for (var i = 0; i < YandexApiOnResponseHandlers.length; i++) {
      if (resource.url.includes(YandexApiOnResponseHandlers[i].url)) {
        resp = await YandexApiOnResponseHandlers[i].handler({
          url: resource.url,
          data: resp,
        });
      }
    }

    if (resp) {
      const modifiedResponse = new Response(JSON.stringify(resp));
      return modifiedResponse;
    }

    return new Response(JSON.stringify(data));
  }

  return originalFetch(resource);
};

export const onYandexApiRequest = function (urlMatch, handler) {
  YandexApiOnRequestHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};

export const onYandexApiResponse = function (urlMatch, handler) {
  YandexApiOnResponseHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};

// Текстовые (не-JSON) ответы: хендлер получает {url, text} и может вернуть
// строку с заменой тела ответа; возврат не-строки = без изменений.
export const onYandexApiTextResponse = function (urlMatch, handler) {
  YandexApiOnTextResponseHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};

// Полная подмена JSON-ответа: хендлер получает {url, response} и может вернуть
// объект (подмена) или undefined (штатный флоу). Срабатывает даже если
// оригинальный запрос упал — так обходятся серверные проверки подписки.
export const onYandexApiJsonOverride = function (urlMatch, handler) {
  YandexApiOnJsonOverrideHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};
