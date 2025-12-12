// src/services/oneSignal.service.ts
import axios from "axios";

const ONE_SIGNAL_URL = "https://onesignal.com/api/v1/notifications";

export const pushToDevices = async ({
  playerIds,
  title,
  body,
  data = {},
}: {
  playerIds: string[];
  title: string;
  body: string;
  data?: any;
}) => {
  return axios.post(
    ONE_SIGNAL_URL,
    {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { en: title },
      contents: { en: body },
      data,
    },
    {
      headers: {
        Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
};
