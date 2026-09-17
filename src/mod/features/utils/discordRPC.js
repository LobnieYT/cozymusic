const { BrowserWindow } = require("electron");
const { Client } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1283109459463377011";
const ACTIVITY_COOLDOWN = 10 * 1000;

let lastActivityChanged = 0;
let lastTrackId = null;
let client;

function initRpc() {
  client = new Client({ clientId: CLIENT_ID });

  client.login().catch((e) => {
    console.error("[DISCORD RPC]", e);
    setTimeout(initRpc, 3000);
  });

  client.on("ready", () => {
    console.log("[DISCORD RPC] Hooked!");
    console.log("client.user", client.user?.username);
    // Сразу обновить статус после (пере)подключения, без ожидания кулдауна
    lastActivityChanged = 0;
    lastTrackId = null;
  });

  client.on("disconnected", () => {
    console.log("[DISCORD RPC] Disconnected");
    setTimeout(initRpc, 3000);
  });

  client.on("error", () => {
    console.log("[DISCORD RPC] Error");
    setTimeout(initRpc, 3000);
  });
  client.on("close", () => {
    console.log("[DISCORD RPC] Closed");
    setTimeout(initRpc, 3000);
  });
}

function clearPresence() {
  try {
    if (client && client.user) client.user.clearActivity();
  } catch (e) {}
  lastTrackId = null;
}

async function updateActivity() {
  setTimeout(updateActivity, 500);

  try {
    if (!client || !client.user) return;

    const playerState = await GetAppPlayerState();

    // Состояние плеера недоступно — статус надо УБРАТЬ, а не оставлять висеть старый
    if (!playerState || !playerState.data) {
      clearPresence();
      return;
    }

    // Discord RPC не включен
    if (!playerState.enabled) {
      clearPresence();
      return;
    }

    const playerStateData = playerState.data;

    if (!playerStateData.isPlaying) {
      clearPresence();
      return;
    }

    const trackId = playerStateData.trackMeta && playerStateData.trackMeta.id;
    const trackChanged = trackId !== undefined && trackId !== lastTrackId;

    // Кулдаун действует только пока играет ТОТ ЖЕ трек.
    // Смена трека обновляет статус сразу, иначе в Discord висит старый.
    if (!trackChanged && lastActivityChanged + ACTIVITY_COOLDOWN > Date.now()) return;

    const startTimestamp = Math.round(Date.now() - playerStateData.playback.position * 1000);
    const endTimestamp = Math.round(
      Date.now() + (playerStateData.playback.duration - playerStateData.playback.position) * 1000,
    );

    const rpcRequest = {
      type: 2,
      details: playerStateData.trackMeta.version
        ? `${playerStateData.trackMeta.title} ${playerStateData.trackMeta.version}`
        : playerStateData.trackMeta.title,
      largeImageKey: playerStateData.trackMeta.coverUri
        ? `https://${playerStateData.trackMeta.coverUri.replaceAll("%%", "300x300")}`
        : undefined,
      largeImageKey: playerStateData.trackMeta.coverUri
        ? `https://${playerStateData.trackMeta.coverUri.replaceAll("%%", "100x100")}`
        : undefined,
      state: playerStateData.trackMeta.artists.map((a) => a.name).join(", "),
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
      buttons: [
        {
          label: "🎵 Открыть",
          url: `https://music.yandex.ru/track/${playerStateData.trackMeta.id}`,
        },
      ],
      instance: false,
    };

    if (playerState.showModButton) {
      rpcRequest.buttons.push({
        label: "💻 CozyMusic",
        url: `https://github.com/LobnieYT/cozymusic`,
      });
    }

    client.user.setActivity(rpcRequest);

    lastActivityChanged = Date.now();
    lastTrackId = trackId;
  } catch (ex) {
    console.log("[DISCORD RPC]", ex);
  }
}

initRpc();
updateActivity();

async function GetAppPlayerState() {
  // Окон может быть несколько (основное + OAuth-попапы): ищем то,
  // где живёт модовый API состояния плеера.
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win || win.isDestroyed()) continue;
    try {
      const state = await win.webContents.executeJavaScript(`
        (()=>{
            return typeof window.__getPlayerState === "function" ? window.__getPlayerState() : null;
        })()
       `);
      if (state) return state;
    } catch (e) {}
  }
  return null;
}
