// Медиа-действия в контексте страницы. Вызывается из main-процесса
// через window.__cozyMediaAction(action). Все операции через DOM,
// без зависимости от внутреннего API клиента.

export type MediaAction = "playPause" | "stop" | "next" | "prev" | "volUp" | "volDown";

function clickTestId(ids: string[]): boolean {
  for (const id of ids) {
    const el = document.querySelector(`[data-test-id="${id}"]`) as HTMLElement | null;
    if (el) {
      el.click();
      return true;
    }
  }
  return false;
}

function setInputValue(el: HTMLInputElement, value: number) {
  const proto = window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) desc.set.call(el, String(value));
  else el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function adjustVolume(delta: number): boolean {
  const slider = document.querySelector('[data-test-id="CHANGE_VOLUME_SLIDER"]') as HTMLInputElement | null;
  if (slider) {
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const step = Number(slider.step || 1) || 1;
    const span = max - min || 100;
    const cur = Number(slider.value || 0);
    // шаг слайдера может быть мелким — двигаем минимум на 10% шкалы
    const stepVal = Math.max(step, span / 10) * Math.sign(delta);
    setInputValue(slider, Math.min(max, Math.max(min, cur + stepVal)));
    return true;
  }
  // запасной путь: крутим громкость всех медиа-элементов
  let touched = false;
  document.querySelectorAll("audio, video").forEach((m) => {
    const media = m as HTMLMediaElement;
    media.volume = Math.min(1, Math.max(0, media.volume + delta * 0.1));
    touched = true;
  });
  return touched;
}

function doMediaAction(action: MediaAction): boolean {
  switch (action) {
    case "playPause":
      if (clickTestId(["PAUSE_BUTTON"])) return true;
      return clickTestId(["PLAY_BUTTON"]);
    case "stop":
      // "стоп" = пауза, если играет
      return clickTestId(["PAUSE_BUTTON"]);
    case "next":
      return clickTestId(["NEXT_TRACK_BUTTON"]);
    case "prev":
      return clickTestId(["PREVIOUS_TRACK_BUTTON"]);
    case "volUp":
      return adjustVolume(1);
    case "volDown":
      return adjustVolume(-1);
    default:
      return false;
  }
}

(window as any).__cozyMediaAction = (action: MediaAction) => {
  try {
    const ok = doMediaAction(action);
    console.log(`[media-binds] action ${action}: ${ok ? "ok" : "miss"}`);
    return ok;
  } catch (e) {
    console.error("[media-binds] failed:", e);
    return false;
  }
};
