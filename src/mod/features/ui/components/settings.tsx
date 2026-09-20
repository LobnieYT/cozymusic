import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { getAccountSettings, updateAccountSettings } from "~/mod/features/utils/api";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { toast } from "sonner";

import { AiOutlineExperiment } from "react-icons/ai";
import { Settings as SettingsIcon } from "lucide-react";

export function Settings() {
  async function handleCopyAuthData() {
    const accessToken = localStorage.oauth ? "OAuth " + JSON.parse(localStorage.oauth).value : null;

    const experimentsResponse = await axios.get("https://api.music.yandex.net/account/experiments/details", {
      method: "GET",
      headers: {
        "x-yandex-music-client": "YandexMusicDesktopAppWindows/" + window.VERSION,
        "x-yandex-music-without-invocation-info": "1",
        Authorization: accessToken,
      },
    });

    if (experimentsResponse.status !== 200) {
      console.error("Failed to save experiments", experimentsResponse.status);
      return;
    }

    const data = {
      accessToken: localStorage.oauth ? "OAuth " + JSON.parse(localStorage.oauth).value : null,
      experiments: experimentsResponse.data,
    };

    toast.success("Данные авторизации скопированы");

    return navigator.clipboard.writeText(JSON.stringify(data));
  }

  return (
    <ExpandableCard title="Настройки" icon={<SettingsIcon className="h-4 w-4" />}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger className="w-full">
              <Button onClick={handleCopyAuthData} className="w-full">
                Скопировать данные авторизации
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Если разработчик попросит вас дать доступ к своему аккаунту, вы можете поделиться этими данными.</p>
              <p>Не передавайте их кому-либо еще.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ExpandableCard>
  );
}
