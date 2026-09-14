import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";

import { MicVocal } from "lucide-react";

import { LYRICS_SOURCE_KEY, type LyricsSource } from "~/mod/features/lyrics/lyrics";

const SOURCES: { value: LyricsSource; label: string; hint: string }[] = [
  { value: "yandex", label: "Яндекс Музыка", hint: "Официальные синхронные тексты" },
  { value: "lrclib", label: "LRCLIB (lrclib.net)", hint: "Открытая база синхронных текстов" },
  { value: "musixmatch", label: "Musixmatch", hint: "Тексты и переводы Musixmatch" },
];

export function LyricsSource() {
  const [source, setSource] = useState<LyricsSource>("yandex");

  useEffect(() => {
    (async () => {
      const saved = await window.yandexMusicMod.getStorageValue(LYRICS_SOURCE_KEY);
      if (saved === "lrclib" || saved === "musixmatch" || saved === "yandex") setSource(saved);
    })();
  }, []);

  return (
    <ExpandableCard title="Источник текстов песен" icon={<MicVocal className="h-4 w-4" />}>
      <div className="flex flex-col gap-2 pt-2 px-3">
        <Label htmlFor="lyrics-source-select" className="cursor-pointer">
          Откуда брать синхронный текст песни
        </Label>
        <Select
          value={source}
          onValueChange={(value) => {
            const next = value as LyricsSource;
            setSource(next);
            window.yandexMusicMod.setStorageValue(LYRICS_SOURCE_KEY, next);
          }}
        >
          <SelectTrigger id="lyrics-source-select" className="text-foreground w-full">
            <SelectValue placeholder="Выберите источник" />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs">
          {SOURCES.find((s) => s.value === source)?.hint}. Применяется к следующему открытию текста.
        </span>
      </div>
    </ExpandableCard>
  );
}
