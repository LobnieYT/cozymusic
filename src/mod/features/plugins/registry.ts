export interface PluginMeta {
  /** внутренний id в моде */
  id: string;
  /** имя, под которым плагин просит настройки у pulsesyncApi */
  settingsName: string;
  /** отображаемое имя */
  name: string;
  /** переопределение отображаемого имени (если в metadata upstream другое) */
  displayName?: string;
  author: string;
  description: string;
  repo: string;
  scriptUrl: string;
  styleUrl?: string;
  handlesUrl?: string;
  metaUrl?: string;
  /** id для определения конфликта с обоями мода */
  isCustomBackground?: boolean;
  /** токен для приватных репозиториев (шлётся как Bearer при загрузке файлов) */
  token?: string;
}

const raw = (repo: string, branch: string, file: string) =>
  `https://raw.githubusercontent.com/${repo}/${branch}/${file}`;

export const PLUGIN_REGISTRY: PluginMeta[] = [
  {
    id: "reach-video-cover",
    settingsName: "ReachVideoCover",
    name: "ReachVideoCover",
    author: "Hazzz895",
    description: "Видеофон вместо обложки, когда у трека есть видео.",
    repo: "https://github.com/Hazzz895/ReachVideoCover",
    scriptUrl: raw("Hazzz895/ReachVideoCover", "main", "script.js"),
    styleUrl: raw("Hazzz895/ReachVideoCover", "main", "style.css"),
    handlesUrl: raw("Hazzz895/ReachVideoCover", "main", "handleEvents.json"),
    metaUrl: raw("Hazzz895/ReachVideoCover", "main", "metadata.json"),
  },
  {
    id: "custom-background",
    settingsName: "Custom Background",
    name: "CustomBackground",
    author: "dieugh",
    description: "Свой фон приложения и блока «Моя волна» (картинка/видео). Конфликтует со встроенными обоями мода.",
    repo: "https://github.com/dieughh/CustomBackground",
    scriptUrl: raw("dieughh/CustomBackground", "main", "script.js"),
    styleUrl: raw("dieughh/CustomBackground", "main", "style.css"),
    handlesUrl: raw("dieughh/CustomBackground", "main", "handleEvents.json"),
    metaUrl: raw("dieughh/CustomBackground", "main", "metadata.json"),
    isCustomBackground: true,
  },
  {
    id: "name-avatar-blur",
    settingsName: "Name and Avatar Blur",
    name: "Name and Avatar Blur",
    author: "dobryjigrok, diram1x",
    description: "Блюр имени и аватара для стримов и скриншотов.",
    repo: "https://github.com/mak7im01/Name-and-Avatar-Blur",
    scriptUrl: raw("mak7im01/Name-and-Avatar-Blur", "main", "script.js"),
    styleUrl: raw("mak7im01/Name-and-Avatar-Blur", "main", "style.css"),
    handlesUrl: raw("mak7im01/Name-and-Avatar-Blur", "main", "handleEvents.json"),
    metaUrl: raw("mak7im01/Name-and-Avatar-Blur", "main", "metadata.json"),
  },
  {
    id: "f11-fullscreen",
    settingsName: "F11Fullscreen",
    name: "F11Fullscreen",
    author: "dobryjigrok",
    description: "Клавиша F11 — полноэкранный режим.",
    repo: "https://github.com/mak7im01/F11Fullscreen",
    scriptUrl: raw("mak7im01/F11Fullscreen", "main", "script.js"),
    metaUrl: raw("mak7im01/F11Fullscreen", "main", "metadata.json"),
  },
  {
    id: "fck-censor",
    settingsName: "FckCensor",
    name: "FckCensor",
    author: "Hazzz895",
    description: "Автоподмена заблюренных треков + ручная подмена через контекстное меню.",
    repo: "https://github.com/Hazzz895/FckCensor",
    scriptUrl: raw("Hazzz895/FckCensor", "main", "script.js"),
    metaUrl: raw("Hazzz895/FckCensor", "main", "metadata.json"),
  },
  {
    id: "mainpage-great-again",
    settingsName: "YM Old Home UI",
    name: "MainPage GreatAgain",
    displayName: "Old Home UI",
    author: "desaichk, thekingoftime",
    description: "Возвращает старый дизайн главной страницы.",
    repo: "https://github.com/Desai0/MainPage-GreatAgain",
    scriptUrl: raw("Desai0/MainPage-GreatAgain", "main", "script.js"),
    styleUrl: raw("Desai0/MainPage-GreatAgain", "main", "script.css"),
    handlesUrl: raw("Desai0/MainPage-GreatAgain", "main", "handleEvents.json"),
    metaUrl: raw("Desai0/MainPage-GreatAgain", "main", "metadata.json"),
  },
  {
    id: "slopless",
    settingsName: "Slopless",
    name: "Slopless",
    author: "slyf, alexeyfv",
    description: "Метки ИИ-треков и исполнителей (slopless.art).",
    repo: "https://github.com/tslyf/slopless-pulsesync",
    scriptUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/slopless-pulsesync/script.js",
    handlesUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/slopless-pulsesync/handleEvents.json",
    metaUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/slopless-pulsesync/metadata.json",
  },
  {
    id: "track-follow",
    settingsName: "TrackFollow",
    name: "TrackFollow",
    author: "Le_pexun",
    description: "Добавляет изображение/GIF на прогресс-бар плеера.",
    repo: "https://github.com/Deroff/TrackFollow",
    scriptUrl: raw("Deroff/TrackFollow", "main", "script.js"),
    styleUrl: raw("Deroff/TrackFollow", "main", "style.css"),
    handlesUrl: raw("Deroff/TrackFollow", "main", "handleEvents.json"),
    metaUrl: raw("Deroff/TrackFollow", "main", "metadata.json"),
  },
  {
    id: "better-player",
    settingsName: "BetterPlayer",
    name: "BetterPlayer",
    author: "WolfySoCute, forea.adoxid",
    description: "Кастомизация для стандартного полноэкранного плеера.",
    repo: "https://github.com/WolfySoCute/BetterPlayer-Addon",
    scriptUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/better-player/script.js",
    styleUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/better-player/script.css",
    handlesUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/better-player/handleEvents.json",
    metaUrl:
      "https://raw.githubusercontent.com/LobnieYT/cozymusic/main/plugins/vendor/better-player/metadata.json",
  },
  {
    id: "better-info",
    settingsName: "BetterInfo",
    name: "BetterInfo",
    author: "Hazzz895",
    description: "Дополнительная информация о треке и исполнителе.",
    repo: "https://github.com/Hazzz895/BetterInfo",
    scriptUrl: raw("Hazzz895/BetterInfo", "main", "script.js"),
    styleUrl: raw("Hazzz895/BetterInfo", "main", "style.css"),
    handlesUrl: raw("Hazzz895/BetterInfo", "main", "handleEvents.json"),
    metaUrl: raw("Hazzz895/BetterInfo", "main", "metadata.json"),
  },
  {
    id: "vibecolorizer",
    settingsName: "VibeColorizer",
    name: "VibeColorizer",
    author: "BackUndoTap",
    description: "Окрашивание интерфейса под обложку трека.",
    repo: "https://github.com/backundotapbut/vibecolorizer",
    scriptUrl: raw("backundotapbut/vibecolorizer", "main", "script.js"),
    handlesUrl: raw("backundotapbut/vibecolorizer", "main", "handleEvents.json"),
    metaUrl: raw("backundotapbut/vibecolorizer", "main", "metadata.json"),
  },
  {
    id: "lyrics-translation",
    settingsName: "Lyrics Translation",
    name: "Lyrics Translation",
    author: "maks1mio",
    description: "Перевод текстов песен.",
    repo: "https://github.com/Maks1mio/Lyrics-Translation",
    scriptUrl: raw("Maks1mio/Lyrics-Translation", "main", "script.js"),
    styleUrl: raw("Maks1mio/Lyrics-Translation", "main", "style.css"),
    handlesUrl: raw("Maks1mio/Lyrics-Translation", "main", "handleEvents.json"),
    metaUrl: raw("Maks1mio/Lyrics-Translation", "main", "metadata.json"),
  },
  {
    id: "anticensor",
    settingsName: "AntiCensor",
    name: "AntiCensor",
    author: "LobnieYT",
    description:
      "Подменивает заблюренные треки автоматически и позволяет это делать вручную через контекстное меню. Форк проекта \"FckCensor\"",
    repo: "https://github.com/LobnieYT/AntiCensor",
    scriptUrl: raw("LobnieYT/AntiCensor", "main", "script.js"),
    metaUrl: raw("LobnieYT/AntiCensor", "main", "metadata.json"),
    token: "[REDACTED]",
  },
];
