import type { Lang, LocalizedText, RouteId } from "../../shared/types.js";

export function localize(value: LocalizedText, lang: Lang) {
  return value[lang];
}

export function text(en: string, th: string): LocalizedText {
  return { en, th };
}

export function routeDestinationLabel(routeId: RouteId, target: string) {
  if (routeId === "dragon-line") {
    return text("Old Town loop", "วนเมืองเก่า");
  }

  if (routeId === "rawai-airport") {
    if (target.includes("Airport")) {
      return text("To Phuket Airport", "ไปสนามบินภูเก็ต");
    }

    return text("To Rawai Beach", "ไปราไวย์บีช");
  }

  if (target.includes("Terminal")) {
    return text("To Phuket Bus Terminal 1", "ไปสถานีขนส่งภูเก็ต 1");
  }

  return text("To Patong", "ไปป่าตอง");
}
