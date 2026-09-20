const electron = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const sanitize = require("sanitize-filename");
const axios = require("axios");

// ffmpeg-static (либа которая бандлит бинарники ffmpeg)
const pathToFfmpeg = require("ffmpeg-static").replaceAll("app.asar", "app.asar.unpacked");
const { exec } = require("child_process");
console.log("bundled ffmpeg binary path:", pathToFfmpeg);

const appFolder = electron.app.getPath("userData");
const settingsFilePath = path.join(appFolder, "mod_settings.json");
const defaultDownloadPath = path.join(appFolder, "Downloads");

// Создание папки для хранения настроек пользователя
fs.mkdir(appFolder, { recursive: true }, (err) => {
  if (err) return console.error(err);
  console.log("mod_settings directory created successfully!");
});

// Создание папки для загрузки треков
fs.mkdir(defaultDownloadPath, { recursive: true }, (err) => {
  if (err) return console.error(err);
  console.log("Default download directory created successfully!");
});

if (!fs.existsSync(settingsFilePath)) {
  // Initialize settings with default download path on first run
  const initialSettings = {
    downloadFolderPath: defaultDownloadPath,
  };
  fs.writeFileSync(settingsFilePath, JSON.stringify(initialSettings, null, 2));
} else {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    // Set default download path if not already set
    if (!settings.downloadFolderPath) {
      settings.downloadFolderPath = defaultDownloadPath;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    }
  } catch (e) {
    // If settings file is corrupted, recreate with defaults
    const initialSettings = {
      downloadFolderPath: defaultDownloadPath,
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(initialSettings, null, 2));
  }
}

// window API - запрос настроек пользователя
electron.ipcMain.handle("yandexMusicMod.getStorageValue", (_ev, key) => {
  const settings = fs.readFileSync(settingsFilePath, "utf8") || "{}";
  const parsed = JSON.parse(settings);
  return parsed[key] !== undefined ? parsed[key] : null;
});

// window API - установка настроек пользователя
electron.ipcMain.on("yandexMusicMod.setStorageValue", (_ev, key, value) => {
  const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
  settings[key] = value;
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));

  electron.BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send("yandexMusicMod.storageValueUpdated", key, value),
  );
});

// window API - выбор папки для загрузки треков
electron.ipcMain.handle("yandexMusicMod.selectDownloadFolder", async (_ev) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Выберите папку для загрузки треков",
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, path: null };
  }

  return { success: true, path: result.filePaths[0] };
});

// window API - открытие папки для загрузки треков
electron.ipcMain.handle("yandexMusicMod.openFolder", async (_ev, folderPath) => {
  try {
    await electron.openPath(folderPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to open folder:", error);
    return { success: false, error: error.message };
  }
});

// window API - загрузка трека
electron.ipcMain.handle(
  "yandexMusicMod.downloadTrack",
  async (_ev, downloadInfo, trackMeta, customDownloadPath = null) => {
    console.log("Backend get download request: ", downloadInfo.url);

    let saveFolder;
    if (process.platform === "win32") {
      saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
    } else {
      saveFolder = (process.env.HOME || process.env.USERPROFILE) + "/YandexMod Download";
    }

    if (customDownloadPath) {
      saveFolder = customDownloadPath;
    } else {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
        saveFolder = settings.downloadFolderPath || saveFolder;
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }

    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    // Generate filename from trackMeta or use default
    const fileExtension = downloadInfo.codec.includes("flac") ? "flac" : "mp3";
    const trackFileName = sanitize(
      `${trackMeta.artists.map((a) => a.name).join(", ")} - ${trackMeta.title} ${trackMeta.version || ""}`,
    )
      .trim()
      .substring(0, 250);
    const trackFilePath = path.join(saveFolder, `${trackFileName}.${fileExtension}`);
    const trackTempFilePath = path.join(saveFolder, `${Math.random().toString(36).substring(2, 7)}.${fileExtension}`);
    const trackCoverPath = path.join(saveFolder, `${trackFileName}.jpg`);

    try {
      // Download file using axios with arraybuffer response type
      const response = await axios.get(downloadInfo.url, {
        responseType: "arraybuffer",
        validateStatus: () => true, // Following neverthrow integration pattern
      });

      if (response.status !== 200) {
        console.error(`Download failed with status: ${response.status}`);
        return { ok: false, error: "Download failed" };
      }

      // Decrypt the data using the decryptYandexAudio function
      const decryptedData = await decryptYandexAudio(response.data, downloadInfo.key);

      // Write decrypted data to file
      fs.writeFile(trackFilePath, Buffer.from(decryptedData), (err) => {
        if (err) {
          console.error("Error saving decrypted file:", err);
          return { ok: false, error: "Error saving decrypted file: " + err };
        }
        console.log("Download and Decryption Completed");
      });

      // 2. Copy/reencode audio using direct ffmpeg command
      await new Promise((resolve, reject) => {
        const ffmpegArgs = ["-i", JSON.stringify(trackFilePath), "-y", JSON.stringify(trackTempFilePath)];
        const command = `${JSON.stringify(pathToFfmpeg)} ${ffmpegArgs.join(" ")}`;

        console.log("Executing FFmpeg command:", command);

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error("FFmpeg stderr:", stderr);
            console.error("FFmpeg error:", error);
            reject(new Error(`FFmpeg process failed. Command: ${command}. Error: ${error.message}`));
          } else {
            resolve();
          }
        });
      });

      // Build ffmpeg arguments for adding metadata and cover
      const ffmpegArgs = ["-i", JSON.stringify(trackTempFilePath)];

      // === Download cover art ===
      if (trackMeta.coverUri) {
        try {
          const url = `https://${trackMeta.coverUri.replaceAll("%%", "orig")}`;
          const coverResponse = await axios.get(url, { responseType: "arraybuffer" });
          fs.writeFileSync(trackCoverPath, coverResponse.data);

          ffmpegArgs.push("-i", JSON.stringify(trackCoverPath));
          ffmpegArgs.push("-map", "0:a", "-map", "1:v", "-y");
        } catch (err) {
          console.warn("Failed to download cover art:", err);
        }
      }

      // Add metadata
      ffmpegArgs.push("-c", "copy");
      ffmpegArgs.push("-id3v2_version", "3");

      if (trackMeta.title) {
        ffmpegArgs.push("-metadata", JSON.stringify(`title=${trackMeta.title}`));
      }
      if (trackMeta.version) {
        ffmpegArgs.push("-metadata", JSON.stringify(`subtitle=${trackMeta.version}`));
      }
      if (trackMeta.artists && trackMeta.artists.length > 0) {
        ffmpegArgs.push("-metadata", JSON.stringify(`artist=${trackMeta.artists.map((a) => a.name).join("/")}`));
      }
      if (trackMeta.albums?.[0]?.title) {
        ffmpegArgs.push("-metadata", JSON.stringify(`album=${trackMeta.albums[0].title}`));
      }
      if (trackMeta.albums?.[0]?.genre) {
        ffmpegArgs.push("-metadata", JSON.stringify(`genre=${trackMeta.albums[0].genre}`));
      }
      if (trackMeta.albums?.[0]?.trackPosition?.index) {
        ffmpegArgs.push("-metadata", JSON.stringify(`track=${trackMeta.albums[0].trackPosition.index}`));
      }
      if (trackMeta.albums?.[0]?.year) {
        ffmpegArgs.push("-metadata", JSON.stringify(`date=${trackMeta.albums[0].year}`));
      }
      if (trackMeta.albums?.[0]?.releaseDate) {
        ffmpegArgs.push("-metadata", JSON.stringify(`releaseDate=${trackMeta.albums[0].releaseDate}`));
      }
      ffmpegArgs.push("-metadata", JSON.stringify("encoded_by=yandexMusicMod"));

      ffmpegArgs.push(JSON.stringify(trackFilePath));

      console.log("ffmpegArgs", ffmpegArgs);

      // Execute ffmpeg command to add metadata and cover
      await new Promise((resolve, reject) => {
        const command = `${pathToFfmpeg} ${ffmpegArgs.join(" ")}`;

        console.log("Executing FFmpeg metadata command:", command);

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error("FFmpeg metadata stderr:", stderr);
            console.error("FFmpeg metadata error:", error);
            reject(new Error(`FFmpeg metadata process failed. Command: ${command}. Error: ${error.message}`));
          } else {
            // Clean up temporary files
            if (fs.existsSync(trackTempFilePath)) {
              fs.unlinkSync(trackTempFilePath);
            }

            resolve();
          }
        });

        console.log("Download completed.");
      });
    } catch (err) {
      console.error("Download or decryption failed:", err);
      return { ok: false, error: "Download or decryption failed: " + err };
    }

    return { ok: true };
  },
);

// window API - открытие папки для загрузки треков
electron.ipcMain.on("yandexMusicMod.openDownloadDirectory", async (_ev) => {
  let saveFolder;
  if (process.platform === "win32") {
    saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
  } else {
    saveFolder = (process.env.HOME || process.env.USERPROFILE) + "/YandexMod Download";
  }

  if (customDownloadPath) {
    saveFolder = customDownloadPath;
  } else {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
      saveFolder = settings.downloadFolderPath || saveFolder;
    } catch (e) {
      console.log("failed to parse settings", e)
    }
  }

  await electron.openPath(saveFolder)
});

// window API - универсальный axios запрос
electron.ipcMain.handle("yandexMusicMod.axios", async (_ev, config) => {
  const client = axios.create({
    validateStatus: () => true,
  });

  const response = await client(config);

  return {
    success: true,
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
});

// window API - принудительное закрытие приложения
electron.ipcMain.handle("yandexMusicMod.forceQuit", async () => {
  console.log("[CozyMusic] force quit requested");
  try {
    electron.app.quit();
  } catch (e) {}
  setTimeout(() => {
    try {
      process.exit(0);
    } catch (e) {}
  }, 800);
  return { success: true };
});

// window API - прозрачность окна (0.2..1, Linux/X11; на Wayland может не работать)
electron.ipcMain.handle("yandexMusicMod.setWindowOpacity", async (_ev, value) => {
  const v = Math.min(1, Math.max(0.2, Number(value) || 1));
  try {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.setOpacity(v);
      } catch (e) {}
    });
  } catch (e) {}
  return { success: true, opacity: v };
});

// ---- Глобальные горячие клавиши (бинды) ----
const MEDIA_BIND_DEFAULTS = {
  playPause: "MediaPlayPause",
  stop: "MediaStop",
  prev: "MediaPreviousTrack",
  next: "MediaNextTrack",
  volUp: "Control+Alt+Up",
  volDown: "Control+Alt+Down",
};

function readModSetting(key, fallback) {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8") || "{}");
    const v = settings[key];
    return v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function runMediaAction(action) {
  try {
    const wins = electron.BrowserWindow.getAllWindows().filter((w) => {
      try {
        return !w.isDestroyed();
      } catch (e) {
        return false;
      }
    });
    const win = wins[0];
    if (!win) return false;
    win.webContents
      .executeJavaScript(`(window.__cozyMediaAction && window.__cozyMediaAction(${JSON.stringify(action)}))`)
      .catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

function refreshGlobalShortcuts() {
  try {
    electron.globalShortcut.unregisterAll();
  } catch (e) {}
  let enabled = readModSetting("binds/enabled", true);
  if (!enabled) {
    console.log("[binds] disabled, shortcuts cleared");
    return { success: true, registered: [] };
  }
  const registered = [];
  for (const [action, defAcc] of Object.entries(MEDIA_BIND_DEFAULTS)) {
    const acc = readModSetting(`binds/${action}`, defAcc);
    if (!acc || typeof acc !== "string") continue;
    try {
      const ok = electron.globalShortcut.register(acc, () => runMediaAction(action));
      if (ok) registered.push({ action, acc });
      else console.error(`[binds] failed to register ${acc} for ${action}`);
    } catch (e) {
      console.error(`[binds] register error ${acc}:`, e.message);
    }
  }
  console.log("[binds] registered:", registered);
  return { success: true, registered };
}

electron.ipcMain.handle("yandexMusicMod.getEnv", async () => {
  try {
    return {
      success: true,
      flatpak: !!process.env.FLATPAK_ID,
      snap: !!(process.env.SNAP || process.env.SNAP_NAME),
      platform: process.platform,
    };
  } catch (e) {
    return { success: false };
  }
});

electron.ipcMain.handle("yandexMusicMod.refreshShortcuts", async () => refreshGlobalShortcuts());
electron.ipcMain.handle("yandexMusicMod.runMediaAction", async (_ev, action) => ({ success: runMediaAction(action) }));

// ---- Проверка обновлений CozyMusic (GitHub releases) ----
function compareVersions(a, b) {
  const norm = (v) =>
    String(v || "")
      .replace(/^v/i, "")
      .split("-")[0]
      .split(".")
      .map((x) => parseInt(x, 10) || 0);
  const pa = norm(a);
  const pb = norm(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

electron.ipcMain.handle("yandexMusicMod.checkUpdate", async (_ev, currentVersion) => {
  try {
    const client = axios.create({ validateStatus: () => true, timeout: 15000 });
    const response = await client.get("https://api.github.com/repos/LobnieYT/cozymusic/releases/latest", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "CozyMusic-updater" },
    });
    if (response.status !== 200 || !response.data || !response.data.tag_name) {
      return { success: false, error: "check_failed" };
    }
    const latest = String(response.data.tag_name);
    const updateAvailable = compareVersions(latest, currentVersion) > 0;
    return { success: true, current: currentVersion, latest, updateAvailable, assets: (response.data.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })) };
  } catch (e) {
    console.error("[updater] check failed:", e.message);
    return { success: false, error: "check_failed" };
  }
});

electron.ipcMain.handle("yandexMusicMod.installUpdate", async (_ev, assetUrl, assetName) => {
  try {
    const os = require("os");
    const { execFile } = require("child_process");
    const tmpFile = path.join(os.tmpdir(), `cozymusic-update-${Date.now()}-${path.basename(String(assetName || "update.bin"))}`);
    console.log("[updater] downloading:", assetUrl);
    const client = axios.create({ validateStatus: () => true, timeout: 60000, responseType: "stream" });
    const response = await client.get(assetUrl, { headers: { "User-Agent": "CozyMusic-updater" } });
    if (response.status !== 200) return { success: false, error: "download_failed" };
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tmpFile);
      response.data.pipe(out);
      out.on("finish", resolve);
      out.on("error", reject);
    });

    const runCmd = (cmd, args) =>
      new Promise((resolve) => {
        execFile(cmd, args, { timeout: 300000 }, (err) => resolve({ code: err ? err.code : 0, error: err ? String(err.message).slice(0, 300) : null }));
      });

    if (process.env.FLATPAK_ID) {
      const r = await runCmd("flatpak", ["install", "--user", "-y", tmpFile]);
      try { fs.rmSync(tmpFile, { force: true }); } catch (e) {}
      if (r.code === 0) return { success: true, method: "flatpak" };
      return { success: false, error: r.error || "install_failed" };
    }
    if (process.env.SNAP || process.env.SNAP_NAME) {
      const r = await runCmd("pkexec", ["snap", "install", "--dangerous", "--classic", tmpFile]);
      try { fs.rmSync(tmpFile, { force: true }); } catch (e) {}
      if (r.code === 0) return { success: true, method: "snap" };
      return { success: false, needManual: true, command: `sudo snap install --dangerous --classic "${tmpFile}"` };
    }
    return { success: false, needManual: true, file: tmpFile };
  } catch (e) {
    console.error("[updater] install failed:", e.message);
    return { success: false, error: "install_failed" };
  }
});

electron.ipcMain.handle("yandexMusicMod.restartApp", async () => {
  try {
    electron.app.relaunch();
    electron.app.exit(0);
  } catch (e) {}
  return { success: true };
});

// ---- Автозапуск (Linux: .desktop в ~/.config/autostart) ----
function getAutostartFile() {
  try {
    const dir = path.join(os.homedir(), ".config", "autostart");
    return { dir, file: path.join(dir, "cozymusic-autostart.desktop") };
  } catch (e) {
    return { dir: null, file: null };
  }
}

function getAutostartExec() {
  if (process.env.FLATPAK_ID) return "flatpak run --user org.cozymusic.player";
  if (process.env.SNAP || process.env.SNAP_NAME) return "/snap/bin/cozymusic-player";
  try {
    return process.execPath;
  } catch (e) {
    return "";
  }
}

function applyAutostart(enabled) {
  try {
    const { dir, file } = getAutostartFile();
    if (!dir || !file) return { success: false };
    if (enabled) {
      fs.mkdirSync(dir, { recursive: true });
      const execLine = getAutostartExec();
      if (!execLine) return { success: false };
      fs.writeFileSync(
        file,
        `[Desktop Entry]\nType=Application\nName=CozyMusic\nComment=CozyMusic autostart\nExec=${execLine} %U\nTerminal=false\nX-GNOME-Autostart-enabled=true\nNoDisplay=false\n`,
      );
    } else {
      fs.rmSync(file, { force: true });
    }
    return { success: true, enabled: !!enabled };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

electron.ipcMain.handle("yandexMusicMod.setAutostart", async (_ev, enabled) => applyAutostart(!!enabled));
electron.ipcMain.handle("yandexMusicMod.getAutostart", async () => {
  try {
    const { file } = getAutostartFile();
    return { success: true, enabled: !!(file && fs.existsSync(file)) };
  } catch (e) {
    return { success: false, enabled: false };
  }
});

// применить автозапуск и шорткаты из сохранённых настроек.
// globalShortcut работает только после app.ready — откладываем.
function scheduleShortcutRefresh() {
  try {
    if (electron.app.isReady()) refreshGlobalShortcuts();
    else electron.app.whenReady().then(() => refreshGlobalShortcuts()).catch(() => {});
  } catch (e) {}
}
try {
  applyAutostart(readModSetting("autostart/enabled", false));
} catch (e) {}
scheduleShortcutRefresh();

// window API - пользовательские шрифты (файлы в userData/cozy-fonts)
const fontsDir = path.join(appFolder, "cozy-fonts");
const FONT_MIME = { ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2" };

electron.ipcMain.handle("yandexMusicMod.listUserFonts", async () => {
  try {
    fs.mkdirSync(fontsDir, { recursive: true });
    return {
      success: true,
      fonts: fs
        .readdirSync(fontsDir)
        .filter((f) => FONT_MIME[path.extname(f).toLowerCase()])
        .map((f) => {
          const st = fs.statSync(path.join(fontsDir, f));
          return { file: f, name: path.basename(f, path.extname(f)), size: st.size };
        }),
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

electron.ipcMain.handle("yandexMusicMod.saveUserFont", async (_ev, payload) => {
  try {
    if (!payload || !payload.dataBase64) return { success: false, error: "empty" };
    fs.mkdirSync(fontsDir, { recursive: true });
    const origName = String(payload.name || "font").slice(0, 80);
    let ext = path.extname(origName).toLowerCase();
    if (!FONT_MIME[ext]) {
      const sniff = Buffer.from(payload.dataBase64.slice(0, 8), "base64");
      ext = sniff.subarray(0, 4).toString() === "wOF2" ? ".woff2" : sniff.subarray(0, 4).toString() === "wOFF" ? ".woff" : sniff[0] === 0 && sniff[1] === 1 && sniff[2] === 0 && sniff[3] === 0 ? ".ttf" : sniff.subarray(0, 4).toString() === "OTTO" ? ".otf" : ".ttf";
    }
    const base = sanitize(path.basename(origName, path.extname(origName)) || "font") || "font";
    let file = `${base}${ext}`;
    let i = 1;
    while (fs.existsSync(path.join(fontsDir, file))) file = `${base}-${i++}${ext}`;
    const buf = Buffer.from(payload.dataBase64, "base64");
    if (buf.length > 25 * 1024 * 1024) return { success: false, error: "too_big" };
    fs.writeFileSync(path.join(fontsDir, file), buf);
    const st = fs.statSync(path.join(fontsDir, file));
    return { success: true, font: { file, name: path.basename(file, ext), size: st.size } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

electron.ipcMain.handle("yandexMusicMod.deleteUserFont", async (_ev, file) => {
  try {
    const safe = path.basename(String(file || ""));
    if (!safe || !FONT_MIME[path.extname(safe).toLowerCase()]) return { success: false };
    fs.rmSync(path.join(fontsDir, safe), { force: true });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

electron.ipcMain.handle("yandexMusicMod.readUserFont", async (_ev, file) => {
  try {
    const safe = path.basename(String(file || ""));
    const ext = path.extname(safe).toLowerCase();
    if (!safe || !FONT_MIME[ext]) return { success: false };
    const data = fs.readFileSync(path.join(fontsDir, safe));
    return { success: true, dataBase64: data.toString("base64"), mime: FONT_MIME[ext] };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Функция для расшифровки зашифрованного трека
async function decryptYandexAudio(encryptedData, secretKey) {
  const hexToUint8Array = (hexString) => new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", hexToUint8Array(secretKey), { name: "AES-CTR" }, false, [
    "encrypt",
    "decrypt",
  ]);

  let counter = new Uint8Array(16);
  return crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 128 }, cryptoKey, encryptedData);
}

// Discord RPC (из-за того, что main.js не бандлится а просто добавляется в оригинальный index.js, все импорты приходится делать вручную. Строчка ниже просто заменится на содержимое файла src\mod\features\utils\discordRPC.js)
mod_require("discordRPC");
