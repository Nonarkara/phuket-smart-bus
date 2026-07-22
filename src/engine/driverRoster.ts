/**
 * Land-bus driver roster — one named Thai driver per plate.
 *
 * Faces are procedural 8-bit SVGs (Kimi-style B&W pixel portraits), seeded
 * from the plate so the same bus always shows the same person. No random
 * network avatars; no AI imagery.
 */

export type DriverProfile = {
  driverId: string;
  nameTh: string;
  nameEn: string;
  plate: string;
  vehicleId: string;
  routeId: string;
  employeeNo: string;
  /** Years with PKSB — deterministic from plate. */
  yearsService: number;
  licenseClass: "ท.2" | "ท.3";
  homeDepot: "Airport" | "Patong" | "Chalong";
  /** Inline SVG data URI — 16×16 crispEdges portrait. */
  faceDataUri: string;
  faceSeed: number;
};

const FIRST_TH = [
  "สมชาย", "วิชัย", "ประเสริฐ", "สุรชัย", "อนุชา", "ธนา", "พีระ", "กิตติ",
  "ชาญชัย", "วรพงษ์", "ศุภชัย", "มนตรี", "อภิชาต", "ณรงค์", "สมบัติ",
  "ธีรพงษ์", "วิทยา", "บุญชัย", "เอกชัย", "พงศ์ศักดิ์", "รัชต์", "นิรันดร์",
];

const LAST_TH = [
  "วงศ์สุวรรณ", "จันทร์เพ็ญ", "ศรีสุข", "ทองดี", "บุญมี", "พูลสุข",
  "รัตนะ", "ใจดี", "สุวรรณภูมิ", "แซ่ลิ้ม", "เจริญสุข", "มณีรัตน์",
  "ศรีทอง", "อินทร์แก้ว", "โพธิ์ทอง", "นาคทอง", "แสงทอง", "ชัยมงคล",
  "อรุณรัตน์", "พรหมมา", "วัฒนา", "เกตุแก้ว",
];

const FIRST_EN = [
  "Somchai", "Wichai", "Prasert", "Surachai", "Anucha", "Thana", "Peera", "Kitti",
  "Chanchai", "Woraphong", "Supachai", "Montree", "Apichat", "Narong", "Sombat",
  "Teeraphong", "Wittaya", "Boonchai", "Ekkachai", "Pongsak", "Ratch", "Nirun",
];

const LAST_EN = [
  "Wongsuvan", "Chanpen", "Srisuk", "Thongdee", "Boonmee", "Poonsuk",
  "Rattana", "Jaidee", "Suvarnabhumi", "Sae-Lim", "Charoensuk", "Maneerat",
  "Srithong", "Inkaew", "Phothong", "Nakthong", "Saengthong", "Chaimongkol",
  "Arunrat", "Promma", "Wattana", "Ketkaew",
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** 16×16 B&W pixel face — circle-cropped in CSS; house-law circles only. */
export function buildPixelFaceSvg(seed: number): string {
  const rnd = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const skin = rnd(1) > 0.5 ? "#d4d4d4" : "#c8c8c8";
  const hair = rnd(2) > 0.35 ? "#1a1a1a" : "#2e2e2e";
  const ink = "#0a0a0a";
  const bg = "#f0f0f0";
  const shirt = rnd(3) > 0.5 ? "#3a3a3a" : "#1f1f1f";

  const cells: string[] = [];
  const px = (x: number, y: number, fill: string) => {
    cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`);
  };

  // Background
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, bg);

  // Hair crown
  const hairline = 2 + Math.floor(rnd(4) * 2);
  for (let x = 4; x <= 11; x++) px(x, hairline, hair);
  for (let x = 3; x <= 12; x++) px(x, hairline + 1, hair);
  for (let x = 2; x <= 13; x++) px(x, hairline + 2, hair);

  // Face oval
  for (let y = hairline + 3; y <= 11; y++) {
    const inset = y <= hairline + 4 || y >= 10 ? 1 : 0;
    for (let x = 3 + inset; x <= 12 - inset; x++) px(x, y, skin);
  }

  // Eyes
  const eyeY = hairline + 5;
  px(5, eyeY, ink);
  px(6, eyeY, ink);
  px(9, eyeY, ink);
  px(10, eyeY, ink);
  if (rnd(5) > 0.55) {
    // Glasses bridge
    px(7, eyeY, ink);
    px(8, eyeY, ink);
  }

  // Nose / mouth
  px(7, eyeY + 2, "#9a9a9a");
  const smile = rnd(6) > 0.4;
  if (smile) {
    px(6, eyeY + 3, ink);
    px(7, eyeY + 3, ink);
    px(8, eyeY + 3, ink);
  } else {
    px(6, eyeY + 3, ink);
    px(7, eyeY + 3, ink);
  }

  // Beard / stubble variant
  if (rnd(7) > 0.55) {
    for (let x = 5; x <= 10; x++) px(x, 11, "#8a8a8a");
  }

  // Collar / shirt
  for (let x = 4; x <= 11; x++) px(x, 13, shirt);
  for (let x = 3; x <= 12; x++) px(x, 14, shirt);
  for (let x = 2; x <= 13; x++) px(x, 15, shirt);

  // Hat variant (cap)
  if (rnd(8) > 0.72) {
    for (let x = 3; x <= 12; x++) px(x, 1, ink);
    for (let x = 2; x <= 13; x++) px(x, 2, ink);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${cells.join("")}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function depotForRoute(routeId: string): DriverProfile["homeDepot"] {
  if (routeId === "patong-old-bus-station") return "Patong";
  if (routeId === "dragon-line") return "Chalong";
  return "Airport";
}

const cache = new Map<string, DriverProfile>();

/** Resolve a stable driver profile for a land-bus plate / vehicle. */
export function getDriverProfile(opts: {
  vehicleId: string;
  plate: string;
  routeId: string;
}): DriverProfile {
  const key = opts.vehicleId || opts.plate;
  const hit = cache.get(key);
  if (hit) return hit;

  const h = hashStr(key);
  const fi = h % FIRST_TH.length;
  const li = (h >>> 8) % LAST_TH.length;
  const yearsService = 2 + (h % 14);
  const employeeNo = `DRV-${String(1000 + (h % 9000)).padStart(4, "0")}`;
  const faceSeed = h;

  const profile: DriverProfile = {
    driverId: `drv-${key}`,
    nameTh: `${FIRST_TH[fi]} ${LAST_TH[li]}`,
    nameEn: `${FIRST_EN[fi]} ${LAST_EN[li]}`,
    plate: opts.plate,
    vehicleId: opts.vehicleId,
    routeId: opts.routeId,
    employeeNo,
    yearsService,
    licenseClass: yearsService >= 8 ? "ท.3" : "ท.2",
    homeDepot: depotForRoute(opts.routeId),
    faceDataUri: buildPixelFaceSvg(faceSeed),
    faceSeed,
  };
  cache.set(key, profile);
  return profile;
}
