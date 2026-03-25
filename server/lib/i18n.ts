import type { Lang, LocalizedText, RouteId } from "../../shared/types.js";

export function localize(value: LocalizedText, lang: Lang) {
  return value[lang];
}

export function text(en: string, th: string, zh?: string, de?: string, fr?: string, es?: string): LocalizedText {
  return { en, th, zh: zh ?? en, de: de ?? en, fr: fr ?? en, es: es ?? en };
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

  if (routeId === "patong-old-bus-station") {
    if (target.includes("Terminal")) {
      return text("To Phuket Bus Terminal 1", "ไปสถานีขนส่งภูเก็ต 1");
    }
    return text("To Patong", "ไปป่าตอง");
  }

  if (routeId === "rassada-phi-phi") {
    if (target.includes("Phi Phi")) return text("To Phi Phi Island", "ไปเกาะพีพี");
    return text("To Rassada Pier", "ไปท่าเรือรัษฎา");
  }

  if (routeId === "rassada-ao-nang") {
    if (target.includes("Ao Nang")) return text("To Ao Nang (Krabi)", "ไปอ่าวนาง (กระบี่)");
    return text("To Rassada Pier", "ไปท่าเรือรัษฎา");
  }

  if (routeId === "bang-rong-koh-yao") {
    if (target.includes("Koh Yao")) return text("To Koh Yao Noi", "ไปเกาะยาวน้อย");
    return text("To Bang Rong Pier", "ไปท่าเรือบางโรง");
  }

  if (routeId === "chalong-racha") {
    if (target.includes("Racha")) return text("To Racha Island", "ไปเกาะราชา");
    return text("To Chalong Pier", "ไปท่าเรือฉลอง");
  }

  return text("To Patong", "ไปป่าตอง");
}
