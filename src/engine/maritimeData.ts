/**
 * Phuket Maritime Intelligence & Pier Shore-Departure Clearance
 *
 * Models sea conditions, wave heights, and official Marine Department
 * (สำนักงานเจ้าท่าภูมิภาคสาขาภูเก็ต) safety warnings governing whether
 * ships, ferries, catamarans, and speedboats can legally and safely
 * leave the shores of Phuket.
 */

import type { LatLngTuple } from "@shared/types";
import { text } from "./i18n";

export type MaritimeFlag = "green" | "yellow" | "red";

export interface PierMaritimeStatus {
  pierId: string;
  nameEn: string;
  nameTh: string;
  coordinates: LatLngTuple;
  destinations: string[];
  flag: MaritimeFlag;
  waveHeightM: number;
  windSpeedKph: number;
  smallBoatsAllowed: boolean;
  ferriesAllowed: boolean;
  statusLabelEn: string;
  statusLabelTh: string;
  advisoryEn: string;
  advisoryTh: string;
  updatedAt: string;
}

export interface MaritimeOverview {
  flag: MaritimeFlag;
  waveHeightM: number;
  windSpeedKph: number;
  smallBoatsAllowed: boolean;
  ferriesAllowed: boolean;
  officialOrder: {
    en: string;
    th: string;
  };
  piers: PierMaritimeStatus[];
  openSeaExposure: "sheltered" | "moderate" | "rough" | "dangerous";
  updatedAt: string;
}

export const PHUKET_PIERS: {
  id: string;
  nameEn: string;
  nameTh: string;
  coordinates: LatLngTuple;
  destinations: string[];
  exposure: "open_sea" | "partially_sheltered" | "sheltered_bay";
}[] = [
  {
    id: "rassada",
    nameEn: "Rassada Pier",
    nameTh: "ท่าเรือรัษฎา",
    coordinates: [7.8574, 98.3947],
    destinations: ["Koh Phi Phi", "Ao Nang", "Railay Beach", "Koh Lanta"],
    exposure: "open_sea", // Crosses open Andaman Sea to Phi Phi
  },
  {
    id: "chalong",
    nameEn: "Chalong Pier",
    nameTh: "ท่าเรือฉลอง",
    coordinates: [7.8281, 98.3613],
    destinations: ["Coral Island (Koh Hey)", "Koh Racha Yai", "Racha Noi"],
    exposure: "open_sea", // Direct south Andaman swell
  },
  {
    id: "bang-rong",
    nameEn: "Bang Rong Pier",
    nameTh: "ท่าเรือบางโรง",
    coordinates: [8.0133, 98.4186],
    destinations: ["Koh Yao Noi", "Koh Yao Yai", "Phang Nga"],
    exposure: "sheltered_bay", // Sheltered inside Phang Nga Bay
  },
  {
    id: "ao-po",
    nameEn: "Ao Po Grand Marina",
    nameTh: "อ่าวปอ แกรนด์ มารีน่า",
    coordinates: [8.0672, 98.4419],
    destinations: ["Phang Nga Bay", "James Bond Island", "Krabi Yacht Charter"],
    exposure: "partially_sheltered",
  },
];

/**
 * Calculates official Marine Department safety flag and departure clearance
 * from wind speed (km/h) and wave height (meters).
 */
export function evaluateMaritimeSafety(
  waveHeightM: number,
  windSpeedKph: number,
  isMonsoonSquall = false
): {
  flag: MaritimeFlag;
  smallBoatsAllowed: boolean;
  ferriesAllowed: boolean;
  statusLabelEn: string;
  statusLabelTh: string;
  officialOrder: { en: string; th: string };
} {
  // Red Flag: Waves > 2.0m OR Wind > 40 km/h OR active monsoon storm squall
  // Under Marine Dept regulation: Small boats (<12m) strictly prohibited from leaving shore
  if (waveHeightM >= 2.0 || windSpeedKph >= 42 || isMonsoonSquall) {
    return {
      flag: "red",
      smallBoatsAllowed: false,
      ferriesAllowed: waveHeightM < 3.2, // Very heavy seas (>3.2m) ground even large ferries
      statusLabelEn: "RED FLAG · SMALL BOATS PROHIBITED FROM LEAVING SHORE",
      statusLabelTh: "ธงแดง · ห้ามเรือเล็กออกจากฝั่งเด็ดขาด",
      officialOrder: {
        en: "Official Phuket Marine Department Warning: Severe sea swell and wind gusts. All small boats, speedboats, and tourist catamarans are strictly prohibited from leaving shore. Ferries operating under extreme caution.",
        th: "ประกาศเตือนสำนักงานเจ้าท่าภูมิภาคสาขาภูเก็ต: ทะเลมีคลื่นลมแรง คลื่นสูงเกิน 2 เมตร ห้ามเรือเล็กและเรือสปีดโบ๊ทออกจากฝั่งโดยเด็ดขาด เรือโดยสารขนาดใหญ่ให้เดินเรือด้วยความระมัดระวัง",
      },
    };
  }

  // Yellow Flag: Waves 1.4m–2.0m OR Wind 28–42 km/h
  // Caution advised: Small boats advised to stay in sheltered waters
  if (waveHeightM >= 1.4 || windSpeedKph >= 28) {
    return {
      flag: "yellow",
      smallBoatsAllowed: true, // conditionally allowed with caution
      ferriesAllowed: true,
      statusLabelEn: "YELLOW FLAG · MARITIME CAUTION (WAVES ≥1.4M OR WIND ≥28 KM/H)",
      statusLabelTh: "ธงเหลือง · ระวังการเดินเรือ (คลื่น ≥1.4 ม. หรือลม ≥28 กม./ชม.)",
      officialOrder: {
        en: "Phuket Marine Advisory: Moderate sea swell. Small craft must exercise extreme caution. Passengers required to wear life jackets at all times.",
        th: "คำแนะนำการเดินเรือภูเก็ต: ทะเลมีคลื่นปานกลาง เรือเล็กให้ใช้ความระมัดระวังเป็นพิเศษ ผู้โดยสารต้องสวมเสื้อชูชีพตลอดเวลา",
      },
    };
  }

  // Green Flag: Waves < 1.4m AND Wind < 28 km/h
  // All vessels cleared to leave shore
  return {
    flag: "green",
    smallBoatsAllowed: true,
    ferriesAllowed: true,
    statusLabelEn: "GREEN FLAG · NORMAL SEA STATE (ALL VESSELS CLEARED)",
    statusLabelTh: "ธงเขียว · สภาพทะเลปกติ (เรือทุกประเภทออกได้)",
    officialOrder: {
      en: "Normal sea state. All tourist ferries, speedboats, and passenger vessels permitted to leave shore according to schedule.",
      th: "สภาพทะเลปกติ คลื่นลมสงบ เรือโดยสารและสปีดโบ๊ททุกประเภทออกจากฝั่งได้ตามตารางเวลาปกติ",
    },
  };
}

/**
 * Get comprehensive maritime overview across all 4 Phuket tourist piers.
 */
export function getMaritimeOverview(
  baseWaveM = 1.1,
  baseWindKph = 18,
  isMonsoon = false,
  now = new Date()
): MaritimeOverview {
  const overall = evaluateMaritimeSafety(baseWaveM, baseWindKph, isMonsoon && baseWaveM >= 1.8);

  const piers: PierMaritimeStatus[] = PHUKET_PIERS.map((p) => {
    // Open sea piers (Rassada & Chalong) get full swell; sheltered bay gets dampened waves
    const waveMod =
      p.exposure === "open_sea"
        ? 1.0
        : p.exposure === "partially_sheltered"
          ? 0.8
          : 0.6;

    const pierWave = Math.round(baseWaveM * waveMod * 10) / 10;
    const pierSafety = evaluateMaritimeSafety(pierWave, baseWindKph);

    return {
      pierId: p.id,
      nameEn: p.nameEn,
      nameTh: p.nameTh,
      coordinates: p.coordinates,
      destinations: p.destinations,
      flag: pierSafety.flag,
      waveHeightM: pierWave,
      windSpeedKph: Math.round(baseWindKph),
      smallBoatsAllowed: pierSafety.smallBoatsAllowed,
      ferriesAllowed: pierSafety.ferriesAllowed,
      statusLabelEn: pierSafety.statusLabelEn,
      statusLabelTh: pierSafety.statusLabelTh,
      advisoryEn: pierSafety.officialOrder.en,
      advisoryTh: pierSafety.officialOrder.th,
      updatedAt: now.toISOString(),
    };
  });

  const exposure: MaritimeOverview["openSeaExposure"] =
    baseWaveM >= 3.0 ? "dangerous" : baseWaveM >= 2.0 ? "rough" : baseWaveM >= 1.4 ? "moderate" : "sheltered";

  return {
    flag: overall.flag,
    waveHeightM: baseWaveM,
    windSpeedKph: baseWindKph,
    smallBoatsAllowed: overall.smallBoatsAllowed,
    ferriesAllowed: overall.ferriesAllowed,
    officialOrder: overall.officialOrder,
    piers,
    openSeaExposure: exposure,
    updatedAt: now.toISOString(),
  };
}
