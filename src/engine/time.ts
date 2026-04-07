import type { LocalizedText, NextBusContext, TimetableSummary } from "@shared/types";
import { text } from "./i18n";

export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

type TimetableMetadata = {
  label: LocalizedText;
  url: string;
  updatedAt: string | null;
  notes: LocalizedText;
};

export function getBangkokNowMinutes(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const [hour, minute] = formatter
    .format(date)
    .split(":")
    .map((value) => Number(value));

  return hour * 60 + minute;
}

export function parseClockMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(AM|PM)?$/i);

  if (!match) {
    return null;
  }

  const [, rawHour, rawMinute, meridiem] = match;
  const minute = Number(rawMinute);

  if (!meridiem) {
    return Number(rawHour) * 60 + minute;
  }

  let hour = Number(rawHour) % 12;

  if (meridiem.toUpperCase() === "PM") {
    hour += 12;
  }

  return hour * 60 + minute;
}

export function formatClockLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

export function parseScheduleEntries(scheduleText: string) {
  if (scheduleText.includes("Running Every")) {
    const [rawStart = "", rawEnd = ""] = scheduleText.split("~");
    const startMinutes = parseClockMinutes(rawStart.trim());
    const endMinutes = parseClockMinutes(rawEnd.split("Running")[0].trim());
    const intervalMatch = scheduleText.match(/(\d+)\s*Minutes/i);
    const interval = intervalMatch ? Number(intervalMatch[1]) : 15;

    if (startMinutes !== null && endMinutes !== null) {
      const departures: number[] = [];

      for (let value = startMinutes; value <= endMinutes; value += interval) {
        departures.push(value);
      }

      return {
        departures,
        interval
      };
    }
  }

  return {
    departures: scheduleText
      .split(",")
      .map((value) => parseClockMinutes(value.trim()))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b),
    interval: null
  };
}

function buildNextBusContext(
  currentMinutes: number,
  departures: number[],
  interval: number | null
): NextBusContext {
  let nextDeparture = departures.find((value) => value >= currentMinutes);

  if (nextDeparture === undefined) {
    nextDeparture = departures[0] + 24 * 60;
  }

  return {
    label: formatClockLabel(nextDeparture),
    minutesUntil: Math.max(0, nextDeparture - currentMinutes),
    basis: "schedule",
    notes:
      interval === null
        ? text(
            "Based on the published stop timetable.",
            "อิงจากตารางเวลาของป้ายที่เผยแพร่"
          )
        : text(
            `Every ${interval} minutes during the service window.`,
            `วิ่งทุก ${interval} นาทีในช่วงเวลาให้บริการ`
          )
  };
}

export function buildTimetableSummary(
  scheduleText: string,
  metadata: TimetableMetadata,
  now = new Date()
): {
  nextBus: NextBusContext;
  timetable: TimetableSummary;
} {
  const currentMinutes = getBangkokNowMinutes(now);
  const { departures, interval } = parseScheduleEntries(scheduleText);

  if (departures.length > 0) {
    const nextBus = buildNextBusContext(currentMinutes, departures, interval);
    const firstDeparture = departures[0];
    const lastDeparture = departures[departures.length - 1];
    const nextDepartures = departures
      .map((value) => (value >= currentMinutes ? value : value + 24 * 60))
      .sort((a, b) => a - b)
      .slice(0, 3)
      .map((value) => formatClockLabel(value));

    return {
      nextBus,
      timetable: {
        firstDepartureLabel: formatClockLabel(firstDeparture),
        lastDepartureLabel: formatClockLabel(lastDeparture),
        nextDepartures,
        serviceWindowLabel:
          interval === null
            ? `${formatClockLabel(firstDeparture)} - ${formatClockLabel(lastDeparture)}`
            : `${formatClockLabel(firstDeparture)} - ${formatClockLabel(lastDeparture)} · every ${interval} min`,
        sourceLabel: metadata.label,
        sourceUrl: metadata.url,
        sourceUpdatedAt: metadata.updatedAt,
        notes: metadata.notes
      }
    };
  }

  return {
    nextBus: {
      label: "Schedule unavailable",
      minutesUntil: null,
      basis: "fallback",
      notes: text(
        "Use live vehicle movement and route alerts instead.",
        "ให้ใช้ตำแหน่งรถแบบสดและประกาศแจ้งเตือนแทน"
      )
    },
    timetable: {
      firstDepartureLabel: null,
      lastDepartureLabel: null,
      nextDepartures: [],
      serviceWindowLabel: null,
      sourceLabel: metadata.label,
      sourceUrl: metadata.url,
      sourceUpdatedAt: metadata.updatedAt,
      notes: metadata.notes
    }
  };
}

export function getNextBusContext(scheduleText: string, now = new Date()): NextBusContext {
  return buildTimetableSummary(
    scheduleText,
    {
      label: text("Published stop timetable", "ตารางเวลาป้ายที่เผยแพร่"),
      url: "",
      updatedAt: null,
      notes: text("Schedule derived from stop data.", "ตารางเวลาคำนวณจากข้อมูลป้าย")
    },
    now
  ).nextBus;
}
