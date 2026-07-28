import type { Lang, LocalizedText, RouteId } from "@shared/types";

export function localize(value: LocalizedText, lang: Lang) {
  return value[lang];
}

export function text(en: string, th: string, zh?: string, ko?: string, de?: string, fr?: string, es?: string): LocalizedText {
  return { en, th, zh: zh ?? en, ko: ko ?? en, de: de ?? en, fr: fr ?? en, es: es ?? en };
}

export function routeDestinationLabel(routeId: RouteId, target: string) {
  if (routeId === "dragon-line") {
    return text("Old Town loop", "วนเมืองเก่า", "老城环线", "올드타운 순환");
  }

  if (routeId === "rawai-airport") {
    if (target.includes("Airport")) {
      return text("To Phuket Airport", "ไปสนามบินภูเก็ต", "前往普吉机场", "푸껫 공항행");
    }

    return text("To Rawai Beach", "ไปราไวย์บีช", "前往拉威海滩", "라와이 비치행");
  }

  if (routeId === "patong-old-bus-station") {
    if (target.includes("Terminal")) {
      return text("To Phuket Bus Terminal 1", "ไปสถานีขนส่งภูเก็ต 1", "前往普吉客运站1", "푸껫 버스 터미널 1행");
    }
    return text("To Patong", "ไปป่าตอง", "前往芭东", "파통행");
  }

  if (routeId === "rassada-phi-phi") {
    if (target.includes("Phi Phi")) return text("To Phi Phi Island", "ไปเกาะพีพี", "前往皮皮岛", "피피 섬행");
    return text("To Rassada Pier", "ไปท่าเรือรัษฎา", "前往拉沙达码头", "랏사다 부두행");
  }

  if (routeId === "rassada-ao-nang") {
    if (target.includes("Ao Nang")) return text("To Ao Nang (Krabi)", "ไปอ่าวนาง (กระบี่)", "前往奥南（甲米）", "아오 낭 (크라비)행");
    return text("To Rassada Pier", "ไปท่าเรือรัษฎา", "前往拉沙达码头", "랏사다 부두행");
  }

  if (routeId === "bang-rong-koh-yao") {
    if (target.includes("Koh Yao")) return text("To Koh Yao Noi", "ไปเกาะยาวน้อย", "前往瑶诺岛", "코야오노이행");
    return text("To Bang Rong Pier", "ไปท่าเรือบางโรง", "前往邦荣码头", "방롱 부두행");
  }

  if (routeId === "chalong-racha") {
    if (target.includes("Racha")) return text("To Racha Island", "ไปเกาะราชา", "前往皇帝岛", "라차 섬행");
    return text("To Chalong Pier", "ไปท่าเรือฉลอง", "前往查龙码头", "찰롱 부두행");
  }

  return text("To Patong", "ไปป่าตอง", "前往芭东", "파통행");
}