// @ts-nocheck

electron.contextBridge.exposeInMainWorld("yandexMusicMod", {
  getStorageValue: (key: string) => electron.ipcRenderer.invoke("yandexMusicMod.getStorageValue", key),
  setStorageValue: (key: string, value: any) => electron.ipcRenderer.send("yandexMusicMod.setStorageValue", key, value),
  onStorageChanged: (cb: Function) => {
    const listener = (_e, key, value) => cb(key, value);
    electron.ipcRenderer.on("yandexMusicMod.storageValueUpdated", listener);
    return () => electron.ipcRenderer.removeListener("yandexMusicMod.storageValueUpdated", listener);
  },
  downloadTrack: (downloadInfo: any, trackMeta: any, customDownloadPath?: string) =>
    electron.ipcRenderer.invoke("yandexMusicMod.downloadTrack", downloadInfo, trackMeta, customDownloadPath),
  openDownloadDirectory: () => electron.ipcRenderer.send("yandexMusicMod.openDownloadDirectory"),
  selectDownloadFolder: () => electron.ipcRenderer.invoke("yandexMusicMod.selectDownloadFolder"),
  openFolder: (folderPath: string) => electron.ipcRenderer.invoke("yandexMusicMod.openFolder", folderPath),
  axios: (config: any) => electron.ipcRenderer.invoke("yandexMusicMod.axios", config),
  forceQuit: () => electron.ipcRenderer.invoke("yandexMusicMod.forceQuit"),
  getEnv: () => electron.ipcRenderer.invoke("yandexMusicMod.getEnv"),
  toggleDevTools: () => electron.ipcRenderer.invoke("yandexMusicMod.toggleDevTools"),
  logRenderer: (text: string) => electron.ipcRenderer.invoke("yandexMusicMod.logRenderer", { text }),
  setWindowOpacity: (value: number) => electron.ipcRenderer.invoke("yandexMusicMod.setWindowOpacity", value),
  refreshShortcuts: () => electron.ipcRenderer.invoke("yandexMusicMod.refreshShortcuts"),
  runMediaAction: (action: string) => electron.ipcRenderer.invoke("yandexMusicMod.runMediaAction", action),
  checkUpdate: (currentVersion: string) => electron.ipcRenderer.invoke("yandexMusicMod.checkUpdate", currentVersion),
  installUpdate: (assetUrl: string, assetName: string) =>
    electron.ipcRenderer.invoke("yandexMusicMod.installUpdate", assetUrl, assetName),
  restartApp: () => electron.ipcRenderer.invoke("yandexMusicMod.restartApp"),
  setAutostart: (enabled: boolean) => electron.ipcRenderer.invoke("yandexMusicMod.setAutostart", enabled),
  getAutostart: () => electron.ipcRenderer.invoke("yandexMusicMod.getAutostart"),
  listUserFonts: () => electron.ipcRenderer.invoke("yandexMusicMod.listUserFonts"),
  saveUserFont: (payload: { name: string; dataBase64: string }) =>
    electron.ipcRenderer.invoke("yandexMusicMod.saveUserFont", payload),
  deleteUserFont: (file: string) => electron.ipcRenderer.invoke("yandexMusicMod.deleteUserFont", file),
  readUserFont: (file: string) => electron.ipcRenderer.invoke("yandexMusicMod.readUserFont", file),
});

// Register Ctrl+Shift+I to open DevTools (может отсутствовать в preload-контексте — тогда хоткей ставит main-процесс)
try {
  electron.globalShortcut.register("CommandOrControl+Shift+I", () => {
    const focusedWindow = electron.BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.toggleDevTools();
    }
  });
} catch (e) {}
