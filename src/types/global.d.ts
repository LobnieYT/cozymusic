declare global {
  interface Window {
    yandexMusicMod: {
      getStorageValue: (key: string) => any;
      setStorageValue: (key: string, value: any) => void;
      onStorageChanged: (cb: Function) => void;
      downloadTrack: (downloadInfo: any, trackMeta: any, customDownloadPath?: string) => any;
      selectDownloadFolder: () => Promise<{ success: boolean; path: string | null }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      openDownloadDirectory: () => void;
      axios: (config: any) => Promise<{ success: boolean; data?: any; status?: number }>;
      forceQuit: () => Promise<{ success: boolean }>;
      setWindowOpacity: (value: number) => Promise<{ success: boolean; opacity?: number }>;
      listUserFonts: () => Promise<{ success: boolean; fonts?: { file: string; name: string; size: number }[] }>;
      saveUserFont: (payload: { name: string; dataBase64: string }) => Promise<{ success: boolean; font?: { file: string; name: string; size: number }; error?: string }>;
      deleteUserFont: (file: string) => Promise<{ success: boolean }>;
      readUserFont: (file: string) => Promise<{ success: boolean; dataBase64?: string; mime?: string }>;
    };
    VERSION: string;
    __getPlayerState: () => any;
  }
}
