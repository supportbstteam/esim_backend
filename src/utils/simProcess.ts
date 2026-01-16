import { Esim } from "../entity/Esim.entity";
import moment from "moment";
import axios from "axios";

export const processEsim = async (esim: Esim, esimRepo: any, headers: any) => {
  if (!esim.iccid) return esim;

  try {
    // 1️⃣ Always call /show
    const { data: showRes } = await axios.get(
      `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/show`,
      { headers }
    );

    const showData = showRes?.data;
    if (!showData) return esim;

    const {
      data_usage,
      network_status,
      status_text,
      validity_days,
      data,
    } = showData;

    esim.networkStatus = network_status ?? esim.networkStatus;
    esim.statusText = status_text ?? esim.statusText;
    esim.validityDays = validity_days ?? esim.validityDays;
    esim.dataAmount = data ?? esim.dataAmount;

    // CASE 1️⃣ — NOT ACTIVE
    if (!data_usage && !network_status) {
      esim.isActive = false;
      await esimRepo.save(esim);
      return esim;
    }

    // CASE 2️⃣ — ACTIVE
    if (data_usage && network_status === "ACTIVE") {
      const { data: usageRes } = await axios.get(
        `${process.env.TURISM_URL}/v2/sims/${esim.iccid}/usage`,
        { headers }
      );

      const usageData = usageRes?.data?.data;
      if (!usageData) {
        await esimRepo.save(esim);
        return esim;
      }

      const {
        remaining_days,
        total_data,
        remaining_data,
        expired_at,
        status,
      } = usageData;

      esim.remainingData = remaining_data;
      esim.isActive = status === "ACTIVE";
      esim.validityDays = remaining_days ?? esim.validityDays;
      esim.dataAmount = total_data ? total_data / 1024 : esim.dataAmount;

      if (expired_at) {
        const endDate = moment(expired_at, "YYYY-MM-DD HH:mm:ss");
        const today = moment();
        esim.endDate = expired_at.slice(0, 10);
        esim.isExpiry = endDate
          .startOf("day")
          .isSameOrBefore(today.startOf("day"));
      }
    }

    await esimRepo.save(esim);
    return esim;
  } catch (err: any) {
    console.error(`eSIM ${esim.iccid} failed:`, err.message);
    return esim;
  }
};
