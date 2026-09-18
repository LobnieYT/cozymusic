import { initPluginsEngine } from "./loader";
import { installAddonHost } from "./addon-host";

// Сторонние плагины с GitHub: shim pulsesyncApi + хост Addon + загрузчик.
installAddonHost();
initPluginsEngine();
