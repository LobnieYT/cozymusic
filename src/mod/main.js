const electron = require("electron");
const fs = require("fs");
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
