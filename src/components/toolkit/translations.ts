/**
 * Toolkit translations — shared catalog for all research hub components.
 *
 * Organized by component section. Each key maps to a 4-language entry
 * (en, th, zh, ko). The research hub targets English, Thai, Chinese,
 * and Korean — the four languages most relevant to the depa × USDOT
 * audience and Phuket's visitor demographics.
 */

import type { Lang } from "@shared/types";

type Entry = Record<Lang, string>;

// Full 7-language type is required by Lang, but the toolkit only
// populates 4 languages (en, th, zh, ko). This cast keeps the catalog
// terse without breaking the LocalizedText contract.
const e = (en: string, th: string, zh: string, ko: string): Entry =>
  ({ en, th, zh, ko, de: en, fr: en, es: en }) as Entry;

// ===========================================================================
// HUB — navigation, tabs, footer
// ===========================================================================

export const HUB: Record<string, Entry> = {
  // Document title
  docTitle: e(
    "How to Build a Public Transit System · The Case of Phuket Smart Bus",
    "วิธีสร้างระบบขนส่งสาธารณะ · กรณีภูเก็ต สมาร์ท บัส",
    "如何建设公共交通系统 · 普吉智能巴士案例",
    "대중교통 시스템 구축 방법 · 푸껫 스마트 버스 사례"
  ),

  // Brand row
  brandTitle: e(
    "How to Build a Public Transit System",
    "วิธีสร้างระบบขนส่งสาธารณะ",
    "如何建设公共交通系统",
    "대중교통 시스템 구축 방법"
  ),
  brandSubtitle: e(
    "The Case of Phuket Smart Bus · depa × USDOT",
    "กรณีภูเก็ต สมาร์ท บัส · depa × USDOT",
    "普吉智能巴士案例 · depa × USDOT",
    "푸껫 스마트 버스 사례 · depa × USDOT"
  ),
  liveSystemLink: e("Live system ↗", "ระบบสด ↗", "实时系统 ↗", "실시간 시스템 ↗"),
  homeAria: e("Home", "หน้าแรก", "首页", "홈"),

  // Tabs
  tabOverview: e("Overview", "ภาพรวม", "概述", "개요"),
  tabOverviewShort: e("Home", "หน้าแรก", "首页", "홈"),
  tabOverviewKicker: e("The argument in 5 minutes", "สรุปประเด็นใน 5 นาที", "5分钟论点", "5분 요약"),

  tabPhuket: e("Phuket", "ภูเก็ต", "普吉", "푸껫"),
  tabPhuketShort: e("Phuket", "ภูเก็ต", "普吉", "푸껫"),
  tabPhuketKicker: e("The island + the bus systems", "เกาะ + ระบบรถบัส", "岛屿 + 巴士系统", "섬 + 버스 시스템"),

  tabEvidence: e("Evidence", "หลักฐาน", "证据", "증거"),
  tabEvidenceShort: e("Proof", "ข้อมูล", "实证", "증명"),
  tabEvidenceKicker: e("Vegas + global benchmarks", "ลาสเวกัส + มาตรฐานสากล", "拉斯维加斯 + 全球基准", "라스베이거스 + 글로벌 벤치마크"),

  tabBuild: e("Build & Finance", "สร้างและการเงิน", "建设与融资", "구축 및 재무"),
  tabBuildShort: e("Build", "สร้าง", "建设", "구축"),
  tabBuildKicker: e("Method + prototype + deal", "วิธีการ + ต้นแบบ + ข้อตกลง", "方法 + 原型 + 方案", "방법론 + 프로토타입 + 거래"),

  tabFieldNotes: e("Field Notes", "บันทึกภาคสนาม", "实地笔记", "현장 노트"),
  tabFieldNotesShort: e("Notes", "บันทึก", "笔记", "노트"),
  tabFieldNotesKicker: e("People + history + sources", "บุคคล + ประวัติ + แหล่งข้อมูล", "人物 + 历史 + 来源", "사람 + 역사 + 출처"),

  // Overview tab content
  overviewKicker: e("Start here · use the tabs above to go deeper", "เริ่มที่นี่ · ใช้แท็บด้านบนเพื่อดูเพิ่มเติม", "从这里开始 · 使用上方标签深入探索", "여기서 시작 · 상단 탭으로 더 깊이"),
  overviewTitle: e("This is a research hub, not a slide deck.", "นี่คือศูนย์วิจัย ไม่ใช่สไลด์นำเสนอ", "这是研究中心，不是幻灯片。", "이것은 연구 허브이며 슬라이드 데크가 아닙니다."),
  overviewBody: e(
    "The overview is the five-minute argument. Four reading paths take it deeper: the island and its transport system; the evidence and comparisons; the method, prototype and deal; and the people and sources behind the work. Every number traces back to a source or a calculation.",
    "ภาพรวมคือสรุปประเด็นในห้านาที เส้นทางการอ่านสี่เส้นทางจะพาไปลึกขึ้น: เกาะและระบบขนส่ง; หลักฐานและการเปรียบเทียบ; วิธีการ ต้นแบบและข้อตกลง; และบุคคลและแหล่งข้อมูลเบื้องหลังผลงาน ทุกตัวเลขสามารถย้อนกลับไปหาแหล่งที่มาหรือการคำนวณได้",
    "概述是五分钟论点。四条阅读路径带您深入：岛屿及其交通系统；证据与比较；方法、原型与方案；以及工作背后的人物与来源。每个数字都能追溯到来源或计算。",
    "개요는 5분 요약입니다. 네 가지 읽기 경로가 더 깊이 안내합니다: 섬과 교통 시스템, 증거와 비교, 방법론·프로토타입·거래, 그리고 작업 뒤에 있는 사람들과 출처. 모든 숫자는 출처나 계산으로 추적할 수 있습니다."
  ),

  // Overview tab nav
  navPhuketLabel: e("The island + bus systems", "เกาะ + ระบบรถบัส", "岛屿 + 巴士系统", "섬 + 버스 시스템"),
  navEvidenceLabel: e("Vegas + global benchmarks", "ลาสเวกัส + มาตรฐานสากล", "拉斯维加斯 + 全球基准", "라스베이거스 + 글로벌 벤치마크"),
  navBuildLabel: e("Method + prototype + deal", "วิธีการ + ต้นแบบ + ข้อตกลง", "方法 + 原型 + 方案", "방법론 + 프로토타입 + 거래"),
  navFieldNotesLabel: e("People + history + sources", "บุคคล + ประวัติ + แหล่งข้อมูล", "人物 + 历史 + 来源", "사람 + 역사 + 출처"),

  // Build tab intro
  buildKicker: e("Method · how findings become instruments", "วิธีการ · สิ่งที่ค้นพบกลายเป็นเครื่องมือ", "方法 · 发现如何成为工具", "방법론 · 발견이 도구가 되는 방법"),
  buildTitle: e("Observe → Frame → Trace → Build → Operate → Learn.", "สังเกต → กำหนดกรอบ → ติดตาม → สร้าง → ดำเนินการ → เรียนรู้", "观察 → 定义 → 追踪 → 建设 → 运营 → 学习。", "관찰 → 정의 → 추적 → 구축 → 운영 → 학습."),
  buildBody: e(
    "The toolkit's method is a loop, not a line. Each step produces evidence the next step uses. The sections below trace the full chain: from the pain map through personas, causal tests, the working system and the feasibility study.",
    "วิธีการของชุดเครื่องมือเป็นวงวน ไม่ใช่เส้นตรง แต่ละขั้นตอนสร้างหลักฐานที่ขั้นตอนถัดไปใช้ ส่วนต่างๆ ด้านล่างติดตามห่วงโซ่ทั้งหมด: จากแผนที่ความเจ็บปวดผ่านบุคลิกภัณฑ์ การทดสอบเชิงสาเหตุ ระบบที่ใช้งานได้ และการศึกษาความเป็นไปได้",
    "工具包的方法是一个循环，不是一条直线。每一步都产生下一步使用的证据。以下各节追踪完整链条：从痛点图到用户画像、因果测试、可用系统和可行性研究。",
    "툴킷의 방법론은 순환이며 선이 아닙니다. 각 단계는 다음 단계가 사용하는 증거를 생산합니다. 아래 섹션들은 전체 체인을 추적합니다: 페인 맵부터 페르소나, 인과 테스트, 작동하는 시스템, 타당성 조사까지."
  ),

  // Footer
  footerCredit: e(
    "The City Systems Toolkit · depa × USDOT learning journey · built in Phuket",
    "ชุดเครื่องมือระบบเมือง · การเดินทางเรียนรู้ depa × USDOT · สร้างในภูเก็ต",
    "城市系统工具包 · depa × USDOT 学习之旅 · 在普吉创建",
    "시티 시스템 툴킷 · depa × USDOT 학습 여정 · 푸껫에서 구축"
  ),
  footerTagline: e("Research asks why. Building finds out.", "งานวิจัยถามว่าทำไม การสร้างค้นพบคำตอบ", "研究问为什么。建设找出答案。", "연구는 왜라고 묻습니다. 구축은 답을 찾습니다."),
  footerSeeRunning: e("See what is already running", "ดูสิ่งที่กำลังทำงานอยู่", "查看正在运行的系统", "이미 운영 중인 시스템 보기"),
};

// ===========================================================================
// LANDING PAGE — the front door
// ===========================================================================

export const LANDING: Record<string, Entry> = {
  // Hero
  heroKicker: e(
    "How to Build a Public Transit System · The Case of Phuket Smart Bus",
    "วิธีสร้างระบบขนส่งสาธารณะ · กรณีภูเก็ต สมาร์ท บัส",
    "如何建设公共交通系统 · 普吉智能巴士案例",
    "대중교통 시스템 구축 방법 · 푸껫 스마트 버스 사례"
  ),
  heroTitle: e(
    "Let's rehearse: how do you build a transit system from scratch?",
    "มาซ้อมกัน: จะสร้างระบบขนส่งสาธารณะจากศูนย์อย่างไร?",
    "我们来排练：如何从零建设一套公交系统？",
    "리허설: 대중교통 시스템을 처음부터 어떻게 만들 것인가?"
  ),
  heroSub: e(
    "Demand first. Then justify the cost of not building. Then prove feasibility the Virgin Atlantic way — one working plane before a fleet. Law, PPP and concession come next. Only then do we size buses, add on-demand, watch drivers, wire cameras and payments, connect boats, and price against Grab and the rental car.",
    "ความต้องการก่อน แล้วค่อยพิสูจน์ต้นทุนของการไม่สร้าง จากนั้นพิสูจน์ความเป็นไปได้แบบ Virgin Atlantic — เครื่องบินหนึ่งลำที่ใช้งานได้ก่อนทั้งฝูง กฎหมาย PPP และสัมปทานมาทีหลัง ค่อยตัดสินจำนวนรถ เพิ่มออนดีมานด์ ดูคนขับ ใส่กล้องและการชำระเงิน เชื่อมเรือ และเทียบราคา Grab กับรถเช่า",
    "先看需求。再论证不建设的代价。再用维珍大西洋的方式证明可行性——先有一架能飞的飞机，再谈机队。法律、PPP与特许经营随后。然后才定车队规模、按需调度、监测司机、接入摄像与支付、连接船运，并与Grab和租车比价。",
    "수요가 먼저입니다. 그다음 만들지 않을 때의 비용을 정당화합니다. 그다음 Virgin Atlantic 방식으로 타당성을 증명합니다 — 함대 전에 작동하는 비행기 한 대. 법·PPP·양허가 다음입니다. 그제야 버스 대수, 온디맨드, 운전기사 모니터링, 카메라·결제, 선박 연결, Grab·렌터카 대비 가격을 봅니다."
  ),

  // Status legend
  statusObserved: e("Observed", "สังเกตได้", "已观察", "관찰됨"),
  statusObservedNote: e("cited or published record", "ข้อมูลที่อ้างถึงหรือเผยแพร่", "引用或公开的记录", "인용 또는 공개된 기록"),
  statusModelled: e("Modelled", "จำลองแล้ว", "已建模", "모델링됨"),
  statusModelledNote: e("calculated by this repository", "คำนวณโดยพื้นที่เก็บนี้", "由本仓库计算", "이 저장소에서 계산됨"),
  statusProposed: e("Proposed", "เสนอแล้ว", "已提议", "제안됨"),
  statusProposedNote: e("still needs a decision or pilot", "ยังต้องการการตัดสินใจหรือการทดลอง", "仍需决策或试点", "결정이나 시범 운영이 필요함"),
  statusBuildReady: e("Build-ready", "พร้อมสร้าง", "可建设", "구축 준비 완료"),
  statusDueDiligence: e("Due diligence", "ตรวจสอบอย่างละเอียด", "尽职调查", "실사"),

  // Hero stats
  statPaxMovements: e("HKT passenger movements", "ผู้โดยสารผ่านสนามบิน HKT", "HKT机场旅客吞吐量", "HKT 공항 승객 이동"),
  statPaxNote: e("observed · AOT 2025", "สังเกต · AOT 2025", "已观察 · AOT 2025", "관찰 · AOT 2025"),
  statDepartures: e("airport departures in the timetable", "เที่ยวรถจากสนามบินในตารางเวลา", "时刻表中的机场出发班次", "시간표 내 공항 출발편"),
  statDeparturesNote: e("observed · current fixture", "สังเกต · ข้อมูลปัจจุบัน", "已观察 · 当前数据集", "관찰 · 현재 데이터"),
  statSeats: e("seats per airport bus", "ที่นั่งต่อรถบัสสนามบิน", "每辆机场巴士座位数", "공항 버스당 좌석"),
  statSeatsNote: e("modelled capacity", "ความจุที่จำลอง", "建模容量", "모델링된 용량"),
  statPilot: e("instrumented pilot", "การทดลองที่มีการวัด", "仪表化试点", "계측된 시범"),
  statPilotNote: e("proposed decision", "การตัดสินใจที่เสนอ", "提议的决策", "제안된 결정"),

  // Hero buttons
  tryPassengerScreen: e("Try the passenger screen", "ลองหน้าจอผู้โดยสาร", "试用乘客界面", "승객 화면 체험"),
  followWholeSystem: e("Follow the whole system", "ติดตามระบบทั้งหมด", "追踪整个系统", "전체 시스템 따라가기"),

  // Signal chain
  signalKicker: e("One screen · five consequences", "หน้าจอเดียว · ห้าผลกระทบ", "一个屏幕 · 五个后果", "하나의 화면 · 다섯 가지 결과"),
  signalTitle: e(
    "A ticket is not the end of the journey. It is the first useful signal.",
    "ตั๋วไม่ใช่จุดสิ้นสุดของการเดินทาง แต่เป็นสัญญาณแรกที่มีประโยชน์",
    "车票不是旅程的终点。它是第一个有用的信号。",
    "티켓은 여정의 끝이 아닙니다. 그것은 첫 번째 유용한 신호입니다."
  ),
  signalBody: e(
    "The design stays simple because the machinery behind it is explicit. Each handoff creates a record, and each record answers a different decision.",
    "การออกแบบยังคงเรียบง่ายเพราะกลไกเบื้องหลังชัดเจน การส่งมอบแต่ละครั้งสร้างบันทึก และบันทึกแต่ละรายการตอบการตัดสินใจที่แตกต่างกัน",
    "设计保持简洁，因为背后的机制是明确的。每次交接都创建一条记录，每条记录回答一个不同的决策。",
    "디자인은 그 뒤의 기계 장치가 명시적이기 때문에 단순하게 유지됩니다. 각 인계는 기록을 생성하고, 각 기록은 다른 결정에 답합니다."
  ),

  // Signal chain actors
  actorPassenger: e("Passenger", "ผู้โดยสาร", "乘客", "승객"),
  actorDriver: e("Driver", "คนขับ", "司机", "운전기사"),
  actorVehicle: e("Vehicle", "ยานพาหนะ", "车辆", "차량"),
  actorOperator: e("Operator", "ผู้ประกอบการ", "运营商", "운영사"),
  actorLender: e("Lender / city", "ผู้ให้กู้ / เมือง", "贷方 / 城市", "대출기관 / 도시"),

  signalPassengerAction: e("destination + pass", "จุดหมาย + บัตร", "目的地 + 通行证", "목적지 + 패스"),
  signalDriverAction: e("safe drop-off request", "คำขอจอดปล่อยผู้โดยสารอย่างปลอดภัย", "安全下车请求", "안전 하차 요청"),
  signalVehicleAction: e("GPS + anonymous count", "GPS + การนับแบบไม่ระบุตัวตน", "GPS + 匿名计数", "GPS + 익명 카운트"),
  signalOperatorAction: e("queue, load + dispatch", "คิว โหลด + จ่ายงาน", "排队、负载 + 调度", "대기열, 적재 + 배차"),
  signalLenderAction: e("verified outcome", "ผลลัพธ์ที่ตรวจสอบแล้ว", "已验证的结果", "검증된 결과"),

  // Rehearsal spine
  rehearsalKicker: e("The rehearsal", "การซ้อม", "排练", "리허설"),
  rehearsalTitle: e(
    "Ten moves. In this order. Skip one and the fleet becomes a press release.",
    "สิบก้าว ตามลำดับนี้ ข้ามขั้นเดียว กองรถกลายเป็นข่าวประชาสัมพันธ์",
    "十步。按这个顺序。跳过一步，车队就变成新闻稿。",
    "열 단계. 이 순서대로. 하나 건너뛰면 함대는 보도자료가 됩니다."
  ),
  rehearsal01: e("Demand — arrivals, beaches, hotspots", "ความต้องการ — ผู้โดยสาร ชายหาด จุดฮอตสปอต", "需求 — 抵港、海滩、热点", "수요 — 도착·해변·핫스팟"),
  rehearsal02: e("Justify — accidents, congestion, carbon, health", "เหตุผล — อุบัติเหตุ รถติด คาร์บอน สุขภาพ", "论证 — 事故、拥堵、碳、健康", "정당화 — 사고·혼잡·탄소·건강"),
  rehearsal03: e("Feasibility — one working bus before a fleet", "ความเป็นไปได้ — รถหนึ่งคันก่อนทั้งฝูง", "可行性 — 先有一辆能跑的车", "타당성 — 함대 전 작동하는 버스 한 대"),
  rehearsal04: e("Law · PPP · concession years", "กฎหมาย · PPP · ปีสัมปทาน", "法律 · PPP · 特许年限", "법 · PPP · 양허 연한"),
  rehearsal05: e("Size the fleet from measured gaps", "กำหนดจำนวนรถจากช่องว่างที่วัดได้", "按测得缺口定车队规模", "측정된 격차로 함대 규모"),
  rehearsal06: e("On-demand + extra supply at the right hour", "ออนดีมานด์ + เพิ่มซัพพลายในชั่วโมงที่ถูก", "按需 + 在正确时段加运力", "온디맨드 + 올바른 시간의 추가 공급"),
  rehearsal07: e("People — riders and every driver", "คน — ผู้โดยสารและคนขับทุกคน", "人 — 乘客与每位司机", "사람 — 승객과 모든 운전기사"),
  rehearsal08: e("Digital safety — open-loop pay + AI cameras", "ความปลอดภัยดิจิทัล — จ่ายเปิดลูป + กล้อง AI", "数字安全 — 开环支付 + AI摄像", "디지털 안전 — 오픈루프 결제 + AI 카메라"),
  rehearsal09: e("Feeders — boats so nobody is stranded", "ฟีดเดอร์ — เรือเพื่อไม่ให้ใครติดเกาะ", "接驳 — 船运，不让人困住", "피더 — 배에 연결해 고립되지 않게"),
  rehearsal10: e("Price vs Grab / rental · economy of scale", "ราคาเทียบ Grab / รถเช่า · เศรษฐกิจขนาด", "对比Grab/租车定价 · 规模经济", "Grab·렌터카 대비 가격 · 규모의 경제"),

  // Journey / love story
  journeyKicker: e("Jakarta → Johor Bahru", "จาการ์ตา → โจโฮร์บาห์รู", "雅加达 → 新山", "자카르타 → 조호르바루"),
  journeyTitle: e(
    "The workshops were not a tour. They were a relationship.",
    "เวิร์กช็อปไม่ใช่ทัวร์ แต่เป็นความสัมพันธ์",
    "工作坊不是观光。那是一段关系。",
    "워크숍은 관광이 아니었습니다. 관계였습니다."
  ),
  journeyBody: e(
    "From Jakarta 2022 through Los Angeles, Phuket and Boston, to the Johor Bahru reunion — the same people kept showing up with harder questions. That is how a toolkit becomes a running system on an island.",
    "จากจาการ์ตา 2022 ผ่านลอสแองเจลิส ภูเก็ต และบอสตัน ถึงการรวมตัวที่โจโฮร์บาห์รู — คนกลุ่มเดิมกลับมาด้วยคำถามที่ยากขึ้น นั่นคือวิธีที่ชุดเครื่องมือกลายเป็นระบบที่วิ่งบนเกาะ",
    "从2022雅加达，经洛杉矶、普吉、波士顿，到新山重逢——同一群人带着更难的问题不断回来。工具包就是这样变成岛上运转的系统。",
    "2022 자카르타부터 LA·푸껫·보스턴을 거쳐 조호르바루 재회까지 — 같은 사람들이 더 어려운 질문과 함께 다시 모였습니다. 툴킷이 섬에서 돌아가는 시스템이 되는 방식입니다."
  ),
  journeyJakarta: e("Jakarta · Dec 2022 · first workshop", "จาการ์ตา · ธ.ค. 2022 · เวิร์กช็อปแรก", "雅加达 · 2022年12月 · 首次工作坊", "자카르타 · 2022.12 · 첫 워크숍"),
  journeyJohor: e("Johor Bahru · 2025 · the network still alive", "โจโฮร์บาห์รู · 2025 · เครือข่ายยังมีชีวิต", "新山 · 2025 · 网络仍在", "조호르바루 · 2025 · 네트워크는 살아 있음"),
  journeyTonCap: e("Ton Jaitong · Jakarta 2022 · this system is for him", "ต้น ใจทอง · จาการ์ตา 2022 · ระบบนี้สร้างเพื่อเขา", "Ton Jaitong · 雅加达2022 · 本系统为他而建", "Ton Jaitong · 자카르타 2022 · 이 시스템은 그를 위한 것"),

  // Ton dedication
  tonKicker: e("For Ton", "แด่ต้น", "致 Ton", "Ton을 위해"),
  tonTitle: e("The work continues with him in it.", "งานยังดำเนินต่อไปโดยมีเขาอยู่ในนั้น", "工作继续，带着他一起。", "일은 그와 함께 계속됩니다."),
  tonLead: e(
    "This handbook is dedicated to our friend and colleague Ton Jaitong, Team Leader at depa Southern Office, who died unexpectedly last year.",
    "คู่มือนี้ขออุทิศแด่เพื่อนและเพื่อนร่วมงาน ต้น ใจทอง หัวหน้าทีม สำนักงานดีปาภาคใต้ ผู้จากไปอย่างไม่คาดคิดเมื่อปีที่แล้ว",
    "本手册献给好友兼同事、depa南部办公室团队负责人Ton Jaitong——他去年意外离世。",
    "이 핸드북은 작년 예상치 못하게 세상을 떠난 친구이자 동료, depa 남부 사무소 팀장 Ton Jaitong에게 헌정합니다."
  ),
  tonBody: e(
    "Ton was at the first Jakarta workshop in 2022 and kept helping quietly afterwards — including capacity work with farmers in remote communities. The standard he left is simple: technology should leave someone more capable than before.",
    "ต้นอยู่ที่เวิร์กช็อปแรกที่จาการ์ตาปี 2022 และช่วยอย่างเงียบ ๆ ต่อมา — รวมงานสร้างศักยภาพกับเกษตรกรในชุมชนห่างไกล มาตรฐานที่เขาทิ้งไว้เรียบง่าย: เทคโนโลยีควรทำให้คนเก่งขึ้นกว่าเดิม",
    "Ton参加了2022年雅加达首次工作坊，之后一直默默帮忙——包括在偏远社区与农民一起做能力建设。他留下的标准很简单：技术应让人比以前更有能力。",
    "Ton은 2022년 자카르타 첫 워크숍에 있었고 이후에도 조용히 도왔습니다 — 외딴 지역 농민과의 역량 강화 포함. 그가 남긴 기준은 단순합니다: 기술은 사람을 이전보다 더 유능하게 남겨야 합니다."
  ),

  // Five-minute argument
  fiveMinKicker: e("The five-minute build sequence", "ลำดับการสร้างในห้านาที", "五分钟构建序列", "5분 구축 시퀀스"),
  fiveMinTitle: e(
    "Ten questions. In order. Then we are ready to test—not ready to buy buses.",
    "สิบคำถาม ตามลำดับ แล้วเราพร้อมที่จะทดสอบ ไม่ใช่พร้อมที่จะซื้อรถบัส",
    "十个问题。按顺序。然后我们准备好测试——而不是准备买巴士。",
    "열 가지 질문. 순서대로. 그러면 우리는 테스트할 준비가 된 것입니다 — 버스를 살 준비가 아니라."
  ),
  fiveMinSub: e(
    "Read the label on every card. \u201cObserved\u201d is evidence. \u201cModelled\u201d is a calculation. \u201cProposed\u201d is work still owed. Mixing those three is how a sensible pilot turns into a very expensive press release.",
    "อ่านป้ายบนการ์ดทุกใบ \u201cสังเกตได้\u201d คือหลักฐาน \u201cจำลองแล้ว\u201d คือการคำนวณ \u201cเสนอแล้ว\u201d คืองานที่ยังค้าง การผสมสามอย่างนี้คือวิธีที่การทดลองที่สมเหตุสมผลกลายเป็นข่าวประชาสัมพันธ์ที่แพงมาก",
    "阅读每张卡片上的标签。\u201c已观察\u201d是证据。\u201c已建模\u201d是计算。\u201c已提议\u201d是仍欠的工作。混淆这三者就是一个合理的试点变成非常昂贵的新闻稿的方式。",
    "모든 카드의 라벨을 읽으세요. \u201c관찰됨\u201d은 증거입니다. \u201c모델링됨\u201d은 계산입니다. \u201c제안됨\u201d은 아직 해야 할 일입니다. 이 세 가지를 섞는 것이 합리적인 시범 운영이 매우 비싼 보도자료로 변하는 방법입니다."
  ),
  proofKicker: e("What proves it—or still has to", "สิ่งที่พิสูจน์ หรือยังต้องพิสูจน์", "什么证明了它——或仍需证明", "무엇이 증명하는가 — 또는 아직 해야 하는가"),

  // Beats (10 cards) — label, title, body, proof, link
  beat01Label: e("01 · Demand", "01 · ความต้องการ", "01 · 需求", "01 · 수요"),
  beat01Title: e("Is there a need? Count the people coming to Phuket.", "มีความต้องการไหม? นับคนที่มาภูเก็ต", "有没有需求？统计来普吉的人。", "필요가 있는가? 푸껫로 오는 사람을 세라."),
  beat01Body: e(
    "Transit authority and tourism arrivals tell us how many people land at HKT. Travel patterns run to Patong, Old Town and Promthep — most beaches sit on the west coast. Without that map, every bus order is a guess.",
    "หน่วยงานขนส่งและการท่องเที่ยวบอกจำนวนคนที่ลง HKT รูปแบบการเดินทางไปป่าตอง เมืองเก่า และพรหมเทพ — ชายหาดส่วนใหญ่อยู่ฝั่งตะวันตก ไม่มีแผนที่นี้ การสั่งรถทุกครั้งเป็นการเดา",
    "交通与旅游抵达数据告诉我们有多少人降落HKT。出行模式指向芭东、旧城和普罗门天角——多数海滩在西岸。没有这张图，每辆车的订单都是猜测。",
    "교통·관광 도착 데이터는 HKT에 얼마나 많은 사람이 내리는지 알려줍니다. 이동 패턴은 파통·올드타운·프롬텝으로 갑니다 — 대부분 해변은 서쪽에 있습니다. 이 지도 없이 버스 발주는 추측입니다."
  ),
  beat01Proof: e(
    "AOT passenger movements + the operations flight fixture + hotspot shares in the demand engine.",
    "ผู้โดยสาร AOT + ตารางเที่ยวบินปฏิบัติการ + สัดส่วนฮอตสปอตในเครื่องยนต์ความต้องการ",
    "AOT旅客量 + 运营航班样本 + 需求引擎中的热点份额。",
    "AOT 승객 이동 + 운영 항공편 픽스처 + 수요 엔진의 핫스팟 비중."
  ),
  beat01Link: e("Try the passenger screen", "ลองหน้าจอผู้โดยสาร", "试用乘客界面", "승객 화면 체험"),

  beat02Label: e("02 · Justify", "02 · เหตุผล", "02 · 论证", "02 · 정당화"),
  beat02Title: e("What does not building cost — accidents, congestion, carbon, health?", "การไม่สร้างมีต้นทุนอะไร — อุบัติเหตุ รถติด คาร์บอน สุขภาพ?", "不建设的代价是什么——事故、拥堵、碳、健康？", "만들지 않을 때의 비용은? — 사고·혼잡·탄소·건강"),
  beat02Body: e(
    "Before feasibility, show the public cost of single-occupancy vehicles: crashes per year, money lost in congestion, CO₂ and CO burden, and the cardiovascular load that follows dirty air. That is why a transit system earns the right to exist.",
    "ก่อนความเป็นไปได้ แสดงต้นทุนสาธารณะของรถส่วนบุคคล: อุบัติเหตุต่อปี เงินที่หายในรถติด ภาระ CO₂ และ CO และภาระหัวใจที่ตามมลพิษ นั่นคือเหตุผลว่าระบบขนส่งมีสิทธิ์มีอยู่",
    "在可行性之前，先展示单人驾车的公共成本：年事故、拥堵损失、CO₂与CO负担，以及脏空气带来的心血管负荷。这是公交系统有权存在的理由。",
    "타당성 전에 1인 승용차의 공공 비용을 보여 주십시오: 연간 사고, 혼잡 손실, CO₂·CO 부담, 그리고 더러운 공기가 뒤따르는 심혈관 부하. 그것이 대중교통이 존재할 권리를 얻는 이유입니다."
  ),
  beat02Proof: e(
    "Impact and ROI chapters model avoided vehicle-km and CO₂; crash and congestion figures still need sourced local baselines.",
    "บทผลกระทบและ ROI จำลองกม.รถที่หลีกเลี่ยงและ CO₂; ตัวเลขอุบัติเหตุและรถติดยังต้องการฐานข้อมูลท้องถิ่นที่มีแหล่งอ้างอิง",
    "影响与ROI章节建模避免的车公里与CO₂；事故与拥堵数字仍需有来源的本地基线。",
    "영향·ROI 장은 회피된 차량·km와 CO₂를 모델링합니다; 사고·혼잡 수치는 출처 있는 지역 기준선이 아직 필요합니다."
  ),
  beat02Link: e("Open the impact case", "เปิดกรณีผลกระทบ", "打开影响论证", "영향 사례 열기"),

  beat03Label: e("03 · Feasibility", "03 · ความเป็นไปได้", "03 · 可行性", "03 · 타당성"),
  beat03Title: e("Richard Branson bought one plane first. Prove the system with one bus.", "ริชาร์ด แบรนสันซื้อเครื่องบินหนึ่งลำก่อน พิสูจน์ระบบด้วยรถหนึ่งคัน", "理查德·布兰森先买了一架飞机。用一辆巴士证明系统。", "리처드 브랜슨은 먼저 비행기 한 대를 샀습니다. 버스 한 대로 시스템을 증명하십시오."),
  beat03Body: e(
    "Feasibility is not a fleet purchase order. It is a working day: riders board, money settles, the timetable holds. When that works, expand — the same way Virgin Atlantic went from one aircraft to a network.",
    "ความเป็นไปได้ไม่ใช่ใบสั่งซื้อฝูงรถ แต่เป็นวันทำงาน: คนขึ้นเงินเคลียร์ตารางเวลาอยู่ เมื่อนั้นค่อยขยาย — แบบ Virgin Atlantic จากเครื่องเดียวเป็นเครือข่าย",
    "可行性不是车队采购单。它是一个能运转的日子：乘客上车、钱结清、时刻表站住。行得通再扩大——就像维珍大西洋从一架飞机变成网络。",
    "타당성은 함대 발주서가 아닙니다. 작동하는 하루입니다: 승객이 타고, 돈이 정산되고, 시간표가 버팁니다. 되면 확장합니다 — Virgin Atlantic이 한 대에서 네트워크로 간 것과 같습니다."
  ),
  beat03Proof: e(
    "The live simulator + 90-day instrumented pilot gates in the finance chapter.",
    "โปรแกรมจำลองสด + เกตการทดลอง 90 วันในบทการเงิน",
    "实时模拟器 + 财务章节中的90天仪表化试点门槛。",
    "라이브 시뮬레이터 + 재무 장의 90일 계측 시범 관문."
  ),
  beat03Link: e("Inspect the feasibility case", "ตรวจสอบกรณีความเป็นไปได้", "审查可行性案例", "타당성 사례 검토"),

  beat04Label: e("04 · Law & PPP", "04 · กฎหมายและ PPP", "04 · 法律与PPP", "04 · 법·PPP"),
  beat04Title: e("Licensing, partnership and concession years before the shopping list.", "ใบอนุญาต หุ้นส่วน และปีสัมปทานก่อนรายการซื้อ", "先谈许可、伙伴与特许年限，再谈采购清单。", "구매 목록 전에 인허가·파트너십·양허 연한."),
  beat04Body: e(
    "Local law sets who may run routes. PPP and concessional protocols decide how many years a private operator can keep the system — provided they deliver better service under a TOR that already protects users. Extra income is the incentive to keep improving.",
    "กฎหมายท้องถิ่นกำหนดใครวิ่งเส้นทางได้ PPP และพิธีสารสัมปทานตัดสินว่าเอกชนถือระบบกี่ปี — ถ้าส่งมอบบริการดีขึ้นภายใต้ TOR ที่ปกป้องผู้ใช้แล้ว รายได้เพิ่มคือแรงจูงใจให้พัฒนาต่อ",
    "地方法律决定谁可运营线路。PPP与特许协议决定私人运营商可持有系统多少年——前提是在已保护用户的TOR下提供更好服务。额外收入是持续改进的激励。",
    "지방 법이 누가 노선을 운행할 수 있는지 정합니다. PPP와 양허 절차는 민간이 몇 년 시스템을 유지할지 정합니다 — 이미 이용자를 보호하는 TOR 아래 더 나은 서비스를 제공할 때. 추가 수입이 개선을 계속하는 유인입니다."
  ),
  beat04Proof: e(
    "Feasibility separates the operating case from approvals and contracts still needing legal review.",
    "ความเป็นไปได้แยกกรณีดำเนินงานออกจากการอนุมัติและสัญญาที่ยังต้องตรวจทางกฎหมาย",
    "可行性将运营案例与仍需法律审查的批准和合同分开。",
    "타당성은 운영 사례를 법적 검토가 남은 승인·계약과 분리합니다."
  ),
  beat04Link: e("Read the deal structure", "อ่านโครงสร้างข้อตกลง", "阅读交易结构", "거래 구조 읽기"),

  beat05Label: e("05 · Fleet size", "05 · ขนาดกองรถ", "05 · 车队规模", "05 · 함대 규모"),
  beat05Title: e("How many buses? Only the measured gap answers.", "กี่คัน? มีแต่ช่องว่างที่วัดได้เท่านั้นที่ตอบ", "多少辆车？只有测得的缺口能回答。", "버스 몇 대? 측정된 격차만 답합니다."),
  beat05Body: e(
    "The operations dashboard shows which hours the timetable under-serves. That is data-driven redesign: add supply where the queue forms, not where a brochure looks busy.",
    "แดชบอร์ดปฏิบัติการแสดงชั่วโมงที่ตารางเวลารับไม่ไหว นั่นคือการออกแบบใหม่ด้วยข้อมูล: เพิ่มซัพพลายตรงที่คิวเกิด ไม่ใช่ตรงที่โบรชัวร์ดูวุ่น",
    "运营仪表盘显示时刻表在哪些小时供应不足。那就是数据驱动的再设计：在排队形成处加运力，而不是在宣传册看起来热闹的地方。",
    "운영 대시보드는 시간표가 어느 시간에 부족한지 보여 줍니다. 그것이 데이터 기반 재설계입니다: 큐가 생기는 곳에 공급을 더하지, 브로슈어가 바빠 보이는 곳이 아닙니다."
  ),
  beat05Proof: e(
    "Published timetable + 3,944-point route geometry + demand-supply gap by hour.",
    "ตารางเวลาที่เผยแพร่ + เรขาคณิตเส้นทาง 3,944 จุด + ช่องว่างอุปสงค์-อุปทานรายชั่วโมง",
    "公布时刻表 + 3,944点路线几何 + 按小时供需缺口。",
    "공시 시간표 + 3,944점 노선 기하 + 시간별 수요·공급 격차."
  ),
  beat05Link: e("Watch the fleet move", "ดูกองยานพาหนะเคลื่อนที่", "观看车队移动", "차량 대열 이동 보기"),

  beat06Label: e("06 · On-demand", "06 · ออนดีมานด์", "06 · 按需", "06 · 온디맨드"),
  beat06Title: e("Match need exactly — scheduled base, flexible top-up.", "จับความต้องการให้พอดี — ฐานตารางเวลา เสริมยืดหยุ่น", "精确匹配需求——时刻表打底，灵活加量。", "필요를 정확히 맞추라 — 시간표 기반, 유연한 보충."),
  beat06Body: e(
    "On-demand and extra-demand are not slogans. They are the hours and corridors where fixed departures leave people behind — and where a standby bus earns its keep.",
    "ออนดีมานด์และความต้องการพิเศษไม่ใช่สโลแกน แต่เป็นชั่วโมงและเส้นทางที่รอบคงที่ทิ้งคนไว้ — และที่รถสแตนด์บายคุ้มค่า",
    "按需与额外需求不是口号。它们是固定班次把人落下的时段与走廊——也是备用车值得存在的地方。",
    "온디맨드와 추가 수요는 슬로건이 아닙니다. 고정 출발이 사람을 남기는 시간과 구간이며 — 대기 버스가 제값을 하는 곳입니다."
  ),
  beat06Proof: e(
    "Gap rail + Insights view show missed riders and lost revenue by hour from the same engine.",
    "รางช่องว่าง + มุมมอง Insights แสดงผู้โดยสารพลาดและรายได้หายรายชั่วโมงจากเครื่องยนต์เดียวกัน",
    "缺口轨 + Insights视图用同一引擎显示按小时错失乘客与收入。",
    "갭 레일 + Insights 보기는 같은 엔진으로 시간별 놓친 승객·수익을 보여 줍니다."
  ),
  beat06Link: e("Open missed money by hour", "เปิดเงินที่พลาดตามชั่วโมง", "按小时查看错失收入", "시간별 놓친 수익 보기"),

  beat07Label: e("07 · People", "07 · คน", "07 · 人", "07 · 사람"),
  beat07Title: e("Monitor every rider wave and every driver on the roster.", "ดูคลื่นผู้โดยสารและคนขับทุกคนในบัญชี", "监测每一波乘客与名册上的每位司机。", "모든 승객 파도와 명단의 모든 운전기사를 모니터하라."),
  beat07Body: e(
    "Ridership behaviour and driver attention belong in one picture. Capture more of the market only when the people who run the service are visible, rested and accountable.",
    "พฤติกรรมผู้โดยสารและความใส่ใจคนขับอยู่ในภาพเดียว จับตลาดเพิ่มได้เมื่อคนที่วิ่งบริการมองเห็น พักเพียงพอ และรับผิดชอบได้",
    "客流行为与司机注意力应在同一画面。只有当运营的人可见、休息充足、可问责时，才能多占市场份额。",
    "승객 행동과 운전기사 주의력은 한 그림에 있어야 합니다. 서비스를 돌리는 사람이 보이고, 쉬고, 책임질 수 있을 때만 시장을 더 담을 수 있습니다."
  ),
  beat07Proof: e(
    "Driver roster + day records from trip assignments; attention ingest types already wait in the production backend.",
    "บัญชีคนขับ + บันทึกรายวันจากงานเที่ยว; ประเภทการรับความใส่ใจรออยู่ในแบ็กเอนด์ผลิตแล้ว",
    "司机名册 + 来自班次的日记录；注意力摄取类型已在生产后端等待。",
    "운전기사 명단 + 배차에서 나온 일일 기록; 주의력 수집 타입은 이미 프로덕션 백엔드에 대기 중."
  ),
  beat07Link: e("Open the ops console", "เปิดคอนโซลปฏิบัติการ", "打开运营控制台", "운영 콘솔 열기"),

  beat08Label: e("08 · Digital safety", "08 · ความปลอดภัยดิจิทัล", "08 · 数字安全", "08 · 디지털 안전"),
  beat08Title: e("Open-loop payment. Cameras that count — and watch for fatigue.", "จ่ายเปิดลูป กล้องที่นับ — และเฝ้าความเหนื่อยล้า", "开环支付。能计数——并盯住疲劳——的摄像。", "오픈루프 결제. 세고 — 피로를 보는 — 카메라."),
  beat08Body: e(
    "Open-loop fare collection removes friction. Closed-circuit cameras with AI help count boardings and alightings, protect riders, and flag sleepy drivers. Digital encapsulation of safety is not decoration — it is how public transit earns trust.",
    "เก็บค่าโดยสารเปิดลูปลดแรงเสียดทาน กล้องวงจรปิดพร้อม AI ช่วยนับขึ้นลง ปกป้องผู้โดยสาร และเตือนคนขับง่วง การห่อความปลอดภัยด้วยดิจิทัลไม่ใช่ของตกแต่ง — เป็นวิธีที่ขนส่งสาธารณะได้ความไว้ใจ",
    "开环收费减少摩擦。带AI的闭路摄像帮助统计上下车、保护乘客、发现困倦司机。用数字方式封装安全不是装饰——这是公交换取信任的方式。",
    "오픈루프 요금은 마찰을 줄입니다. AI 폐쇄회로 카메라는 승하차를 세고, 승객을 지키며, 졸린 운전기사를 표시합니다. 안전을 디지털로 감싸는 것은 장식이 아닙니다 — 대중교통이 신뢰를 얻는 방식입니다."
  ),
  beat08Proof: e(
    "Payment mock + seat/passenger-flow/driver-attention types and ingest endpoints already exist; vendor PDPA proof still owed.",
    "การชำระเงินจำลอง + ประเภทที่นั่ง/ไหลผู้โดยสาร/ความใส่ใจคนขับและจุดรับมีอยู่แล้ว; การพิสูจน์ PDPA จากผู้ขายยังค้าง",
    "支付原型 + 座位/客流/司机注意力类型与摄取端点已存在；供应商PDPA证明仍欠。",
    "결제 목업 + 좌석·승객흐름·운전기사 주의력 타입·수집 엔드포인트는 이미 존재; 공급업체 PDPA 증명은 아직 남음."
  ),
  beat08Link: e("Trace research into code", "ติดตามงานวิจัยสู่โค้ด", "追踪研究到代码", "연구를 코드로 추적"),

  beat09Label: e("09 · Feeders", "09 · ฟีดเดอร์", "09 · 接驳", "09 · 피더"),
  beat09Title: e("Buses end somewhere. Design the boat so nobody is stranded.", "รถบัสจบที่ไหนสักแห่ง ออกแบบเรือเพื่อไม่ให้ใครติด", "巴士总有终点。设计船运，不让人困住。", "버스는 어딘가에서 끝납니다. 배가 고립을 막도록 설계하십시오."),
  beat09Body: e(
    "Connectivity and feeders — ferries, piers, timed transfers — keep the Complete Trip intact. A bus that drops you short of the island you booked is a system failure, not a scenic pause.",
    "การเชื่อมต่อและฟีดเดอร์ — เรือข้ามฟาก ท่าเทียบ การต่อที่ยืนเวลากัน — คง Complete Trip ไว้ รถที่ส่งคุณไม่ถึงเกาะที่จองไว้คือความล้มเหลวของระบบ ไม่ใช่จุดพักทิวทัศน์",
    "连通与接驳——渡轮、码头、对时换乘——保住完整行程。把人送到预订岛屿半路就停，是系统失败，不是风景休息。",
    "연결과 피더 — 페리·부두·정시 환승 — Complete Trip을 지킵니다. 예약한 섬 앞에서 내리는 버스는 경치 휴식이 아니라 시스템 실패입니다."
  ),
  beat09Proof: e(
    "Transfer-hub schedules (Rassada, Bang Rong, Chalong) live in the engine; ferry demand modelling is still thin.",
    "ตารางศูนย์ต่อ (รัษฎา บางโรง ฉลอง) อยู่ในเครื่องยนต์แล้ว; โมเดลความต้องการเรือยังบาง",
    "换乘枢纽时刻（Rassada、Bang Rong、Chalong）已在引擎中；渡轮需求建模仍薄。",
    "환승 허브 시간표(Rassada·Bang Rong·Chalong)는 엔진에 있음; 페리 수요 모델링은 아직 얇음."
  ),
  beat09Link: e("See the system method", "ดูวิธีการระบบ", "查看系统方法", "시스템 방법론 보기"),

  beat10Label: e("10 · Price & scale", "10 · ราคาและขนาด", "10 · 价格与规模", "10 · 가격·규모"),
  beat10Title: e("Compare Grab. Compare the rental car. Then choose the scale.", "เทียบ Grab เทียบรถเช่า แล้วเลือกระดับ", "对比Grab。对比租车。再选规模。", "Grab을 비교하라. 렌터카를 비교하라. 그다음 규모를 고르라."),
  beat10Body: e(
    "At which fare, which fleet size and which economy of scale does bus beat the private car for the visitor and the island? That is the last question — and the first number an investor should stress-test.",
    "ที่ค่าโดยสารใด ขนาดฝูงใด และเศรษฐกิจขนาดใดที่รถบัสชนะรถส่วนตัวสำหรับนักท่องเที่ยวและเกาะ? นั่นคือคำถามสุดท้าย — และตัวเลขแรกที่นักลงทุนควรทดสอบแรงกดดัน",
    "在哪个票价、哪支车队、哪一规模经济下，巴士对游客和岛屿胜过私家车？那是最后一个问题——也是投资者应压力测试的第一个数字。",
    "어느 요금, 어느 함대, 어느 규모의 경제에서 버스가 방문객과 섬을 위해 자가용을 이기는가? 그것이 마지막 질문이며 — 투자자가 스트레스 테스트해야 할 첫 숫자입니다."
  ),
  beat10Proof: e(
    "Prototype fare ฿100 vs Grab corridor ranges; ROI chapter exposes conditional DSCR — not a purchase order.",
    "ค่าโดยสารต้นแบบ 100 บาท เทียบช่วง Grab ตามทางเดิน; บท ROI เปิด DSCR มีเงื่อนไข — ไม่ใช่ใบสั่งซื้อ",
    "原型票价100泰铢对比走廊Grab区间；ROI章节公开有条件DSCR——不是采购单。",
    "프로토타입 요금 ฿100 대 복도 Grab 구간; ROI 장은 조건부 DSCR을 공개 — 발주서가 아님."
  ),
  beat10Link: e("Stress-test the deal", "ทดสอบแรงกดดันข้อตกลง", "压力测试方案", "거래 스트레스 테스트"),

  // Handover section
  handoverKicker: e("The full research", "งานวิจัยทั้งหมด", "完整研究", "전체 연구"),
  handoverTitle: e("That was the front door. The evidence room is downstairs.", "นั่นคือประตูหน้า ห้องหลักฐานอยู่ชั้นล่าง", "那是前门。证据室在楼下。", "그것은 현관문이었습니다. 증거실은 아래층에 있습니다."),
  handoverBody: e(
    "The long read keeps the Phuket context, Las Vegas comparison, fieldwork, method, causal tests, live model, feasibility study and the people who made the work possible. Dense material gets room to breathe. The argument above tells you why each chapter exists.",
    "บทความยาวเก็บบริบทภูเก็ต การเปรียบเทียบลาสเวกัส งานภาคสนาม วิธีการ การทดสอบเชิงสาเหตุ โมเดลสด การศึกษาความเป็นไปได้ และบุคคลที่ทำให้ผลงานเป็นไปได้ วัสดุหนาแน่นได้รับพื้นที่เพื่อหายใจ อาร์กิวเมนต์ข้างต้นบอกคุณว่าทำไมแต่ละบทถึงมีอยู่",
    "长文保留了普吉背景、拉斯维加斯比较、田野调查、方法、因果测试、实时模型、可行性研究和使工作成为可能的人。密集的材料有呼吸的空间。上面的论点告诉你每个章节为什么存在。",
    "긴 글은 푸껫 배경, 라스베이거스 비교, 현장 조사, 방법론, 인과 테스트, 라이브 모델, 타당성 조사, 그리고 작업을 가능하게 한 사람들을 유지합니다. 밀도 높은 자료가 숨 쉴 공간을 얻습니다. 위의 논증은 각 장이 왜 존재하는지 알려줍니다."
  ),
  handoverOpenResearch: e("Open the full research", "เปิดงานวิจัยทั้งหมด", "打开完整研究", "전체 연구 열기"),
  handoverRunConsole: e("Run the operations console", "เรียกใช้คอนโซลการดำเนินงาน", "运行运营控制台", "운영 콘솔 실행"),

  // Chapter list
  chapter01Name: e("Phuket", "ภูเก็ต", "普吉", "푸껫"),
  chapter01Desc: e("the place and the problem", "สถานที่และปัญหา", "地点和问题", "장소와 문제"),
  chapter02Name: e("Vegas", "เวกัส", "维加斯", "베가스"),
  chapter02Desc: e("the comparison and its limits", "การเปรียบเทียบและข้อจำกัด", "比较及其局限", "비교와 한계"),
  chapter03Name: e("Brief", "สรุป", "简报", "요약"),
  chapter03Desc: e("the conditional recommendation", "ข้อเสนอแนะมีเงื่อนไข", "有条件建议", "조건부 권장사항"),
  chapter04Name: e("Method", "วิธีการ", "方法", "방법론"),
  chapter04Desc: e("how findings become instruments", "สิ่งที่ค้นพบกลายเป็นเครื่องมืออย่างไร", "发现如何成为工具", "발견이 도구가 되는 방법"),
  chapter05Name: e("Proof", "หลักฐาน", "证明", "증명"),
  chapter05Desc: e("the working system and ledger", "ระบบที่ใช้งานได้และบัญชีแยกประเภท", "可运行的系统和账本", "작동하는 시스템과 원장"),
  chapter06Name: e("Feasibility", "ความเป็นไปได้", "可行性", "타당성"),
  chapter06Desc: e("the pilot, finance and exit doors", "การทดลอง การเงิน และทางออก", "试点、财务和退出", "시범 운영, 재무 및 출구"),
};

// ===========================================================================
// PHUKET BUS SYSTEMS — the transit landscape
// ===========================================================================

export const PB: Record<string, Entry> = {
  // Section header
  pbKicker: e("The transit landscape", "ภูมิทัศน์การขนส่ง", "交通格局", "교통 환경"),
  pbTitle: e("What buses already run in Phuket.", "ภูเก็ตมีรถบัสอะไรวิ่งอยู่แล้ว", "普吉已经有哪些巴士在运行。", "푸껫에서 이미 운행 중인 버스."),
  pbStandfirst: e(
    "The answer is messier than visitors expect. Three formal operators, a government competitor on the airport corridor, an informal songthaew network, and a ride-hailing monopoly. The regulatory regime forbids buses from stopping at hotels \u2014 a structural capture suppressor that taxis exploit. Understanding the landscape is step zero before any expansion argument.",
    "คำตอบซับซ้อนกว่าที่นักท่องเที่ยวคาดไว้ มีผู้ประกอบการทางการสามราย คู่แข่งของรัฐบาลในเส้นทางสนามบิน เครือข่ายสองแถวนอกระบบ และผูกขาดการเรียกรถ ระเบียบห้ามรถบัสจอดที่โรงแรม \u2014 ตัวยับยั้งการดึงผู้โดยสารเชิงโครงสร้างที่แท็กซี่ใช้ประโยชน์ การทำความเข้าใจภูมิทัศน์คือขั้นตอนที่ศูนย์ก่อนข้อโต้แย้งการขยายใดๆ",
    "答案比游客预期的更复杂。三家正式运营商、机场走廊上的政府竞争对手、非正式的双条车网络，以及打车垄断。监管制度禁止巴士在酒店停靠——这是出租车利用的结构性客流抑制因素。了解这一格局是任何扩展论证之前的第零步。",
    "답은 방문객이 예상하는 것보다 복잡합니다. 세 곳의 공식 운영사, 공항 복도의 정부 경쟁사, 비공식 송태우 네트워크, 그리고 차량 호출 독점. 규제 체제는 버스가 호텔에 정차하는 것을 금지합니다 \u2014 택시가 이용하는 구조적 승객 유치 억제 요인입니다. 이 환경을 이해하는 것이 어떤 확장 논증 이전의 출발점입니다."
  ),

  // Operator stats
  pbStat1Label: e("formal bus operators in Phuket", "ผู้ประกอบการรถบัสทางการในภูเก็ต", "普吉的正式巴士运营商", "푸껫의 공식 버스 운영사"),
  pbStat1Note: e("PKCD/PKSB \u00b7 Phuket Mahanakorn \u00b7 Orange Line", "PKCD/PKSB \u00b7 ภูเก็ตมหานคร \u00b7 สายส้ม", "PKCD/PKSB \u00b7 普吉马哈纳空 \u00b7 橙线", "PKCD/PKSB \u00b7 푸껫 마하나콘 \u00b7 오렌지 라인"),
  pbStat2Label: e("daily Airport Line departures (each direction)", "เที่ยวรถสายสนามบินต่อวัน (แต่ละทิศทาง)", "每日机场线出发班次（每个方向）", "일일 공항 노선 출발편 (각 방향)"),
  pbStat2Note: e("PKSB timetable, effective Jan 2025", "ตารางเวลา PKSB มีผล ม.ค. 2025", "PKSB时刻表，2025年1月生效", "PKSB 시간표, 2025년 1월 시행"),
  pbStat3Label: e("flat fare, Airport \u2194 Rawai (95 min)", "ค่าโดยสารราคาเดียว สนามบิน \u2194 ราไวย์ (95 นาที)", "统一票价，机场 ↔ 拉威（95分钟）", "균일 요금, 공항 ↔ 라와이 (95분)"),
  pbStat3Note: e("vs \u0e32600\u20131,200 Grab/taxi", "เทียบกับ \u0e32600\u20131,200 Grab/แท็กซี่", "对比฿600–1,200打车/出租车", "Grab/택시 ฿600–1,200 대비"),
  pbStat4Label: e("Dragon Line average boardings", "การขึ้นรถเฉลี่ยสายมังกร", "龙线平均上车人数", "드래곤 라인 평균 승차"),
  pbStat4Note: e("Phuket provincial report, 2024", "รายงานจังหวัดภูเก็ต, 2024", "普吉省报告，2024年", "푸껫 성 보고서, 2024"),

  // Operator cards
  pbOperatorsSubhead: e("The three formal operators", "ผู้ประกอบการทางการทั้งสาม", "三家正式运营商", "세 공식 운영사"),
  pbOpTypeSmartCity: e("Private smart-city", "เอกชนสมาร์ทซิตี้", "私营智慧城市", "민간 스마트시티"),
  pbOpTypeLegacy: e("Private legacy", "เอกชนเดิม", "私营传统", "민간 기존"),
  pbOpTypeGovt: e("Government", "รัฐบาล", "政府", "정부"),

  pbOp1Name: e("Phuket City Development Smart Bus", "ภูเก็ต ซิตี้ ดีเวลลอปเมนท์ สมาร์ท บัส", "普吉城市发展智能巴士", "푸껫 시티 디벨lop먼트 스마트 버스"),
  pbOp1Fleet: e("10 Airport Line vehicles (\u0e01\u0e021001\u20131010) + 7 Patong Line (\u0e01\u0e042001\u20132007) + 3 Dragon Line (\u0e01\u0e073001\u20133003)", "รถสายสนามบิน 10 คัน (\u0e01\u0e021001\u20131010) + สายป่าตอง 7 คัน (\u0e01\u0e042001\u20132007) + สายมังกร 3 คัน (\u0e01\u0e073001\u20133003)", "机场线10辆车（กข 1001–1010）+ 芭东线7辆（กค 2001–2007）+ 龙线3辆（กง 3001–3003）", "공항 노선 차량 10대 (กข 1001–1010) + 파통 노선 7대 (กค 2001–2007) + 드래곤 노선 3대 (กง 3001–3003)"),
  pbOp1Routes: e("Airport Line (Rawai \u2194 HKT, ~95 min), Patong Line (Patong \u2194 Old Town), Dragon Line (Old Town loop)", "สายสนามบิน (ราไวย์ \u2194 HKT, ~95 นาที), สายป่าตอง (ป่าตอง \u2194 เมืองเก่า), สายมังกร (วนรอบเมืองเก่า)", "机场线（拉威 ↔ HKT，约95分钟），芭东线（芭东 ↔ 古城），龙线（古城环线）", "공항 노선 (라와이 ↔ HKT, ~95분), 파통 노선 (파통 ↔ 올드타운), 드래곤 노선 (올드타운 순환)"),
  pbOp1Fare: e("\u0e32100 flat, Airport Line \u00b7 \u0e3240\u2013100 zone-based on other lines", "\u0e32100 ราคาเดียว สายสนามบิน \u00b7 \u0e3240\u2013100 ตามโซนในสายอื่น", "฿100统一价，机场线 · 其他线路฿40–100分区计价", "฿100 균일, 공항 노선 · 기타 노선 ฿40–100 구역별"),
  pbOp1Coverage: e("North\u2013south spine: Airport \u2192 Thalang \u2192 Phuket Town \u2192 Kata/Karon \u2192 Rawai. East\u2013west: Patong \u2194 Old Town.", "แกนเหนือ\u2013ใต้: สนามบิน \u2192 ถลาง \u2192 เมืองภูเก็ต \u2192 กะตะ/กะรน \u2192 ราไวย์ ตะวันออก\u2013ตะวันตก: ป่าตอง \u2194 เมืองเก่า", "南北主轴：机场 → 他朗 → 普吉镇 → 卡塔/卡伦 → 拉威。东西：芭东 ↔ 古城。", "남북 축: 공항 → 탈랑 → 푸껫 타운 → 카타/카론 → 라와이. 동서: 파통 ↔ 올드타운."),
  pbOp1Status: e("Operational. The system this website simulates.", "ดำเนินการอยู่ เป็นระบบที่เว็บไซต์นี้จำลอง", "运营中。本网站模拟的系统。", "운영 중. 이 웹사이트가 시뮬레이션하는 시스템."),
  pbOp1Notes: e("Operated by Phuket City Development (PKCD), supported by depa's smart-city platform. The Airport Line is the corridor the USASCP toolkit studied. 20 vehicles total; the same 10 rotate through both Airport Line directions.", "ดำเนินการโดยภูเก็ต ซิตี้ ดีเวลลอปเมนท์ (PKCD) สนับสนุนโดยแพลตฟอร์มสมาร์ทซิตี้ของ depa สายสนามบินคือเส้นทางที่ชุดเครื่องมือ USASCP ศึกษา รวม 20 คัน; 10 คันเดียวกันหมุนเวียนทั้งสองทิศทางของสายสนามบิน", "由普吉城市发展（PKCD）运营，depa智慧城市平台支持。机场线是USASCP工具包研究的走廊。共20辆车；同样10辆在机场线两个方向轮换。", "푸껫 시티 디벨lop먼트(PKCD)가 운영, depa의 스마트시티 플랫폼 지원. 공항 노선은 USASCP 툴킷이 연구한 복도. 총 20대; 동일한 10대가 공항 노선 양 방향을 순환."),

  pbOp2Name: e("Phuket Mahanakorn", "ภูเก็ตมหานคร", "普吉马哈纳空", "푸껫 마하나콘"),
  pbOp2Fleet: e("Conventional buses (diesel), route-dependent", "รถบัสทั่วไป (ดีเซล) ขึ้นกับเส้นทาง", "传统巴士（柴油），视路线而定", "일반 버스 (디젤), 노선별 상이"),
  pbOp2Routes: e("Local Phuket Town routes, feeder services", "เส้นทางท้องถิ่นในเมืองภูเก็ต บริการส่งต่อ", "普吉镇本地路线，接驳服务", "푸껫 타운 지역 노선, 피더 서비스"),
  pbOp2Fare: e("\u0e3215\u201330, zone-based", "\u0e3215\u201330 ตามโซน", "฿15–30，分区计价", "฿15–30, 구역별"),
  pbOp2Coverage: e("Phuket Town urban core and immediate surroundings. Not airport-connected.", "ใจกลางเมืองภูเก็ตและบริเวณโดยรอบ ไม่เชื่อมสนามบิน", "普吉镇城市核心及周边。不连接机场。", "푸껫 타운 도심 핵심 및 인근. 공항 연결 없음."),
  pbOp2Status: e("Operational but declining ridership. Serves the resident base-load.", "ดำเนินการแต่ผู้โดยสารลดลง ให้บริการฐานผู้อาศัย", "运营中但客流下降。服务居民基础负荷。", "운영 중이나 승객 감소. 거주민 기본 수요 서비스."),
  pbOp2Notes: e("The legacy local operator. Personas 1\u20132 and 7 from the USASCP survey are PMN's core riders: low-income students, bus-friendly freelancers and mid-income residents.", "ผู้ประกอบการท้องถิ่นเดิม บุคลิกภัณฑ์ 1\u20132 และ 7 จากการสำรวจ USASCP คือผู้โดยสารหลักของ PMN: นักเรียนรายได้น้อย ฟรีแลนซ์ที่เหมาะกับรถบัส และผู้อาศัยรายได้ปานกลาง", "传统本地运营商。USASCP调查中的用户画像1–2和7是PMN的核心乘客：低收入学生、适合巴士的自由职业者和中等收入居民。", "기존 지역 운영사. USASCP 조사의 페르소나 1–2와 7이 PMN의 핵심 승객: 저소득 학생, 버스 친화적 프리랜서 및 중간 소득 거주민."),

  pbOp3Name: e("Orange Line (Route 8411)", "สายส้ม (เส้นทาง 8411)", "橙线（路线8411）", "오렌지 라인 (노선 8411)"),
  pbOp3Fleet: e("~3 simulated vehicles in this system; government-operated", "จำลองรถประมาณ 3 คันในระบบนี้; รัฐดำเนินการ", "本系统模拟约3辆车；政府运营", "이 시스템에서 약 3대 시뮬레이션; 정부 운영"),
  pbOp3Routes: e("Airport \u2194 Phuket Town (Bus Terminal 1), via Boat Lagoon, Central/Big C, Pearl Village", "สนามบิน \u2194 เมืองภูเก็ต (สถานีขนส่ง 1) ผ่าน Boat Lagoon, Central/Big C, Pearl Village", "机场 ↔ 普吉镇（客运总站1），经Boat Lagoon、Central/Big C、Pearl Village", "공항 ↔ 푸껫 타운 (버스 터미널 1), Boat Lagoon, Central/Big C, Pearl Village 경유"),
  pbOp3Fare: e("\u0e3285\u2013100", "\u0e3285\u2013100", "฿85–100", "฿85–100"),
  pbOp3Coverage: e("Airport \u2192 Highway 402 \u2192 Phuket Town. Does NOT serve Patong, Kata, Karon or Rawai directly.", "สนามบิน \u2192 ทางหลวง 402 \u2192 เมืองภูเก็ต ไม่ไปป่าตอง กะตะ กะรน หรือราไวย์โดยตรง", "机场 → 402号公路 → 普吉镇。不直接服务芭东、卡塔、卡伦或拉威。", "공항 → 402번 고속도로 → 푸껫 타운. 파통, 카타, 카론, 라와이 직접 서비스 안 함."),
  pbOp3Status: e("Operational. The government competitor on the airport corridor.", "ดำเนินการอยู่ คู่แข่งของรัฐในเส้นทางสนามบิน", "运营中。机场走廊上的政府竞争对手。", "운영 중. 공항 복도의 정부 경쟁사."),
  pbOp3Notes: e("Government-operated, every 60\u201390 min, 08:00\u201321:00, 80 min trip. Cheaper than PKSB but does not reach the west-coast beaches where 60%+ of tourists stay. This is the structural gap the toolkit identified.", "รัฐดำเนินการ ทุก 60\u201390 นาที 08:00\u201321:00 เที่ยวละ 80 นาที ถูกกว่า PKSB แต่ไม่ถึงชายหาดฝั่งตะวันตกที่นักท่องเที่ยว 60%+ พัก นี่คือช่องว่างเชิงโครงสร้างที่ชุดเครื่องมือระบุ", "政府运营，每60–90分钟一班，08:00–21:00，80分钟行程。比PKSB便宜但不覆盖60%以上游客住宿的西海岸海滩。这是工具包识别的结构性缺口。", "정부 운영, 60–90분 간격, 08:00–21:00, 80분 소요. PKSB보다 저렴하지만 관광객 60% 이상이 머무는 서해안 해변에 도달하지 못함. 이것이 툴킷이 식별한 구조적 격차."),

  // DT labels
  pbDtFleet: e("Fleet", "กองยานพาหนะ", "车队", "차량 대열"),
  pbDtRoutes: e("Routes", "เส้นทาง", "路线", "노선"),
  pbDtFare: e("Fare", "ค่าโดยสาร", "票价", "요금"),
  pbDtCoverage: e("Coverage", "พื้นที่ให้บริการ", "覆盖范围", "서비스 범위"),
  pbDtStatus: e("Status", "สถานะ", "状态", "상태"),

  // Competitors
  pbCompetitorsSubhead: e("The substitute ecosystem", "ระบบนิเวศทดแทน", "替代生态系统", "대체 생태계"),
  pbCompetitorsIntro: e(
    "The bus does not compete in an empty market. It competes against six modes, each with a different price, convenience and risk profile. The \u0e32100 bus wins on price; it loses on door-to-door convenience. The question the USASCP toolkit asked: can service quality close the gap?",
    "รถบัสไม่ได้แข่งในตลาดว่าง แต่แข่งกับหกโหมด แต่ละโหมดมีราคา ความสะดวก และความเสี่ยงต่างกัน รถบัส \u0e32100 ชนะเรื่องราคา แพ้เรื่องความสะดวกถึงประตู คำถามที่ชุดเครื่องมือ USASCP ถาม: คุณภาพบริการปิดช่องว่างนี้ได้ไหม?",
    "巴士不是在空白市场竞争。它与六种模式竞争，每种有不同的价格、便利性和风险特征。฿100巴士在价格上获胜；在门到门便利性上失败。USASCP工具包提出的问题：服务质量能弥补差距吗？",
    "버스는 빈 시장에서 경쟁하지 않습니다. 6개 모드와 경쟁하며, 각각 다른 가격, 편의성, 위험 프로필을 가집니다. ฿100 버스는 가격으로 이기고; 문 앞까지의 편의성에서 집니다. USASCP 툴킷이 던진 질문: 서비스 품질이 격차를 좁힐 수 있는가?"
  ),
  pbChMode: e("Mode", "โหมด", "模式", "모드"),
  pbChFare: e("Fare (HKT \u2192 Patong)", "ค่าโดยสาร (HKT \u2192 ป่าตอง)", "票价（HKT → 芭东）", "요금 (HKT → 파통)"),
  pbCh3Mode: e("Official airport taxi", "แท็กซี่สนามบินทางการ", "官方机场出租车", "공항 공식 택시"),
  pbCh4Mode: e("Walk-up touts", "พ่อค้าคนกลางหน้างาน", "揽客黄牛", "현장 호객꾼"),
  pbCh6Mode: e("Motorbike taxi", "มอเตอร์ไซค์รับจ้าง", "摩托出租车", "모터사이클 택시"),
  pbStatsAria: e("Phuket bus system headline figures", "ตัวเลขสำคัญระบบรถบัสภูเก็ต", "普吉巴士系统关键数据", "푸껫 버스 시스템 핵심 수치"),
  pbChAria: e("Competitor modes and fares, HKT to Patong", "โหมดคู่แข่งและค่าโดยสาร HKT ไปป่าตอง", "竞争模式和票价，HKT到芭东", "경쟁 모드 및 요금, HKT에서 파통"),
  pbReg4Body: e("Phuket Provincial Governor's Office", "สำนักงานผู้ว่าราชการจังหวัดภูเก็ต", "普吉府尹办公室", "푸껫 성 지사 사무실"),
  pbReg5Body: e("Phuket Provincial Administration Organization (PAO)", "องค์การบริหารส่วนจังหวัดภูเก็ต (PAO)", "普吉省行政组织（PAO）", "푸껫 성 행정 기구 (PAO)"),
  pbReg6Body: e("Patong Hotel Association / THA Southern Chapter", "สมาคมโรงแรมป่าตอง / สาขาภาคใต้ THA", "芭东酒店协会 / 泰国酒店协会南部分会", "파통 호텔 협회 / THA 남부 지부"),
  pbChWhat: e("What it actually is", "สิ่งที่มันเป็นจริงๆ", "实际上是什么", "실제로 무엇인가"),

  pbCh1Note: e("HKT \u2192 Patong. Legal monopoly inside airport terminal. Only ride-hailing app with official HKT pickup authorisation.", "HKT \u2192 ป่าตอง ผูกขาดตามกฎหมายในอาคารผู้โดยสาร เป็นแอปเรียกรถเพียงตัวที่ได้รับอนุญาตรับผู้โดยสารที่ HKT อย่างเป็นทางการ", "HKT → 芭东。航站楼内法定垄断。唯一获得HKT官方接载授权的打车应用。", "HKT → 파통. 터미널 내 법적 독점. HKT 공식 픽업 승인을 받은 유일한 차량 호출 앱."),
  pbCh2Note: e("20\u201330% cheaper than Grab but cannot pick up inside the airport terminal. Legal since 2023.", "ถูกกว่า Grab 20\u201330% แต่รับผู้โดยสารในอาคารไม่ได้ ถูกต้องตามกฎหมายตั้งแต่ 2023", "比Grab便宜20–30%，但不能在航站楼内接载。2023年起合法。", "Grab보다 20–30% 저렴하지만 공항 터미널 내 픽업 불가. 2023년부터 합법."),
  pbCh3Note: e("Fixed-fare counter. Green-plate, government-regulated.", "เคาน์เตอร์ราคาคงที่ ทะเบียนเขียว กำกับโดยรัฐ", "固定票价柜台。绿牌，政府监管。", "고정 요금 카운터. 녹색 번호판, 정부 규제."),
  pbCh4Note: e("Unregulated. The tout economy the absence of clear public transit creates.", "ไร้การกำกับ เศรษฐกิจนักหาลูกค้าที่เกิดจากการขาดขนส่งสาธารณะที่ชัดเจน", "无监管。缺乏清晰公共交通催生的揽客经济。", "규제 없음. 명확한 대중교통 부재가 만드는 호객 경제."),
  pbCh5Note: e("Red truck, local routes. Cheap but no airport service, no fixed schedule, no English information.", "รถบัสสีแดง เส้นทางท้องถิ่น ถูกแต่ไม่ไปสนามบิน ไม่มีตารางคงที่ ไม่มีข้อมูลภาษาอังกฤษ", "红色卡车，本地路线。便宜但无机场服务，无固定时刻表，无英文信息。", "빨간 트럭, 지역 노선. 저렴하지만 공항 서비스 없음, 고정 시간표 없음, 영어 안내 없음."),
  pbCh6Note: e("Informal. The mode 92.7% of Phuket accidents involve.", "นอกระบบ โหมดที่เกี่ยวข้องกับอุบัติเหตุในภูเก็ต 92.7%", "非正式。92.7%的普吉事故涉及的模式。", "비공식. 푸껫 사고의 92.7%가 관련된 모드."),

  // Regulatory
  pbRegSubhead: e("The regulatory stack \u2014 who can say yes to what", "ชั้นกฎระเบียบ \u2014 ใครอนุมัติอะไรได้", "监管架构——谁能对什么说是", "규제 체계 — 누가 무엇을 승인하는가"),
  pbRegIntro: e(
    "Thailand's transport governance is centralised. The DLT in Bangkok controls route licensing; the Governor in Phuket convenes but cannot overrule. The hotel-stop ban is enforced through CMLT channels. Any expansion plan has to navigate this stack \u2014 not around it.",
    "การกำกับดูแลการคมนาคมของไทยเป็นส่วนกลาง DLT ในกรุงเทพควบคุมการอนุญาตเส้นทาง ผู้ว่าในภูเก็ตเป็นประธานแต่ไม่สามารถล้มคำสั่งได้ การห้ามจอดที่โรงแรมบังคับผ่านช่องทาง CMLT แผนขยายใดต้องเดินผ่านชั้นนี้ \u2014 ไม่ใช่หลีกมัน",
    "泰国的交通治理是中央集权的。曼谷的DLT控制路线许可；普吉府尹召集但不能推翻。酒店停车禁令通过CMLT渠道执行。任何扩展计划都必须穿过这一架构——而不是绕过它。",
    "태국의 교통 거버넌스는 중앙집권적입니다. 방콕의 DLT가 노선 허가를 통제; 푸껫 지사는 소집하지만 번복할 수 없습니다. 호텔 정차 금지는 CMLT 채널을 통해 집행됩니다. 모든 확장 계획은 이 체계를 통과해야 합니다 — 우회가 아닌."
  ),
  pbConstraintLabel: e("Constraint: ", "ข้อจำกัด: ", "约束：", "제약: "),

  pbReg1Role: e("Route planning, operator licensing, regulatory oversight. Bus routes are concessioned at the national level, not provincial.", "วางแผนเส้นทาง อนุญาตผู้ประกอบการ กำกับดูแล เส้นทางรถบัสอนุญาตในระดับชาติไม่ใช่ระดับจังหวัด", "路线规划、运营商许可、监管。巴士路线在国家层面而非省级特许经营。", "노선 계획, 운영사 허가, 규제 감독. 버스 노선은 성 단위가 아닌 국가 단위로 인허가."),
  pbReg1Constraint: e("A Phuket operator cannot launch a new route without DLT approval \u2014 a process that can take months and requires demonstrating public need.", "ผู้ประกอบการภูเก็ตไม่สามารถเปิดเส้นทางใหม่โดยไม่ได้รับอนุมัติ DLT \u2014 กระบวนการที่ใช้เวลาหลายเดือนและต้องแสดงความต้องการของประชาชน", "普吉运营商未经DLT批准不能开通新路线——这一过程可能需要数月，需要证明公共需求。", "푸껫 운영사는 DLT 승인 없이 신규 노선을 개설할 수 없습니다 — 수개월이 걸리고 공공 수요를 입증해야 하는 절차."),
  pbReg2Role: e("National public transport policy and strategic planning. Sets EV bus cost benchmarks (\u0e3212m/vehicle) and identifies financing gaps.", "นโยบายการขนส่งสาธารณะแห่งชาติและการวางแผนยุทธศาสตร์ กำหนดเกณฑ์ต้นทุนรถบัสไฟฟ้า (\u0e3212m/คัน) และระบุช่องว่างการเงิน", "国家公共交通政策和战略规划。设定电动巴士成本基准（฿12m/辆）并识别融资缺口。", "국가 대중교통 정책 및 전략 계획. 전기버스 비용 벤치마크(฿12m/대) 설정 및 재무 격차 식별."),
  pbReg2Constraint: e("OTP's funding mechanism study (2017) is the closest thing to a national clean-bus financing framework \u2014 but it is advisory, not a budget line.", "การศึกษากลไกเงินทุนของ OTP (2017) ใกล้เคียงที่สุดกับกรอบการเงินรถบัสสะอาดระดับชาติ \u2014 แต่เป็นข้อแนะนำไม่ใช่งบประมาณ", "OTP的融资机制研究（2017）是最接近国家清洁巴士融资框架的东西——但它是咨询性的，不是预算拨款。", "OTP의 자금 메커니즘 연구(2017)는 국가 청정버스 재무 프레임워크에 가장 가깝습니다 — 그러나 자문일 뿐 예산 항목이 아닙니다."),
  pbReg3Role: e("Inter-agency coordination, enforcement alignment, operational issue resolution.", "ประสานงานระหว่างหน่วยงาน จัดการการบังคับใช้ แก้ไขปัญหาการดำเนินงาน", "跨机构协调、执法对齐、运营问题解决。", "기관 간 조정, 집행 정렬, 운영 이슈 해결."),
  pbReg3Constraint: e("The hotel-stop ban \u2014 buses may not stop directly at major hotels \u2014 is enforced through CMLT-aligned channels. It is a structural capture suppressor.", "การห้ามจอดที่โรงแรม \u2014 รถบัสห้ามจอดตรงโรงแรมใหญ่ \u2014 บังคับผ่านช่องทาง CMLT เป็นตัวยับยั้งการดึงผู้โดยสารเชิงโครงสร้าง", "酒店停车禁令——巴士不得直接停靠主要酒店——通过CMLT渠道执行。它是结构性客流抑制因素。", "호텔 정차 금지 — 버스가 주요 호텔에 직접 정차할 수 없음 — CMLT 채널을 통해 집행. 구조적 승객 유치 억제 요인."),
  pbReg4Role: e("Coordinates public agencies, supports cross-sector alignment.", "ประสานหน่วยงานรัฐ สนับสนุนการจัดการข้ามภาคส่วน", "协调公共机构，支持跨部门对齐。", "공공 기관 조정, 부문 간 정렬 지원."),
  pbReg4Constraint: e("The Governor can convene but cannot override national DLT route licensing. Political authority is real but legally bounded.", "ผู้ว่าเป็นประธานได้แต่ล้มคำสั่งอนุญาตเส้นทาง DLT ไม่ได้ อำนาจทางการเมืองมีจริงแต่จำกัดทางกฎหมาย", "府尹可以召集但不能推翻国家DLT路线许可。政治权力是真实的但在法律上有界限。", "지사는 소집할 수 있지만 국가 DLT 노선 허가를 번복할 수 없습니다. 정치적 권한은 실재하지만 법적으로 제한됩니다."),
  pbReg5Role: e("Local governmental organisation. Co-design workshop participant in the USASCP toolkit.", "องค์กรปกครองท้องถิ่น ผู้เข้าร่วมเวิร์กช็อปร่วมออกแบบในชุดเครื่องมือ USASCP", "地方政府组织。USASCP工具包联合设计工作坊参与者。", "지역 정부 기관. USASCP 툴킷 공동 설계 워크숍 참여자."),
  pbReg5Constraint: e("PAO controls some local infrastructure (stops, shelters) but not route authority or fare approval.", "PAO ควบคุมโครงสร้างพื้นฐานท้องถิ่นบางส่วน (ป้าย ที่พัก) แต่ไม่มีอำนาจเส้นทางหรืออนุมัติค่าโดยสาร", "PAO控制部分本地基础设施（站点、候车亭），但没有路线权限或票价审批权。", "PAO는 일부 지역 인프라(정류장, 대피소)를 통제하지만 노선 권한이나 요금 승인 권한은 없음."),
  pbReg6Role: e("Tourism-sector coordination. Hotel stop advocacy, information dissemination, service feedback.", "ประสานภาคการท่องเที่ยว การสนับสนุนการจอดที่โรงแรม การเผยแพร่ข้อมูล ผลตอบรับบริการ", "旅游部门协调。酒店停车倡导、信息传播、服务反馈。", "관광 부문 조정. 호텔 정차 옹호, 정보 전파, 서비스 피드백."),
  pbReg6Constraint: e("Hotels want door-adjacent stops. DLT forbids them. The political question: can the hotel lobby change the regulation, or must the bus adapt to it?", "โรงแรมต้องการป้ายใกล้ประตู DLT ห้าม คำถามทางการเมือง: กลุ่มโรงแรมเปลี่ยนระเบียบได้ หรือรถบัสต้องปรับตาม?", "酒店想要门边的站点。DLT禁止。政治问题是：酒店游说团队能改变规定，还是巴士必须适应它？", "호텔은 문 앞 정류장을 원합니다. DLT는 금지합니다. 정치적 질문: 호텔 로비가 규제를 바꿀 수 있는가, 아니면 버스가 적응해야 하는가?"),

  pbLevelNational: e("National", "ระดับชาติ", "国家", "국가"),
  pbLevelProvincial: e("Provincial", "ระดับจังหวัด", "省级", "성 단위"),
  pbLevelIndustry: e("Industry", "อุตสาหกรรม", "行业", "업계"),

  // Structural gap
  pbGapKicker: e("The structural gap", "ช่องว่างเชิงโครงสร้าง", "结构性缺口", "구조적 격차"),
  pbGapTitle: e("The Orange Line is cheaper. The Orange Line doesn't go to the beaches.", "สายส้มถูกกว่า แต่สายส้มไม่ไปชายหาด", "橙线更便宜。橙线不到海滩。", "오렌지 라인이 더 저렴하다. 오렌지 라인은 해변에 가지 않는다."),
  pbGapBody1: e(
    "The government's Orange Line (Route 8411) runs Airport \u2192 Phuket Town for \u0e3285\u2013100. It is the cheapest formal option. But it stops at Bus Terminal 1 in Phuket Town \u2014 not at Patong, Kata, Karon or Rawai, where 60%+ of tourists stay. A tourist arriving at HKT and heading to Patong faces: the \u0e3285 Orange Line to Bus Terminal 1, then a \u0e32400+ songthaew or Grab to Patong. Total: ~\u0e32500 and two transfers.",
    "สายส้มของรัฐ (เส้นทาง 8411) วิ่งสนามบิน \u2192 เมืองภูเก็ต ราคา \u0e3285\u2013100 เป็นทางเลือกทางการที่ถูกที่สุด แต่จอดที่สถานีขนส่ง 1 ในเมืองภูเก็ต \u2014 ไม่ใช่ป่าตอง กะตะ กะรน หรือราไวย์ ที่นักท่องเที่ยว 60%+ พัก นักท่องเที่ยวที่มาถึง HKT และไปป่าตองต้องเผชิญ: สายส้ม \u0e3285 ไปสถานีขนส่ง 1 แล้วต่อสองแถวหรือ Grab \u0e32400+ ไปป่าตอง รวม: ~\u0e32500 และต่อสองครั้ง",
    "政府的橙线（路线8411）从机场到普吉镇，฿85–100。这是最便宜的正式选择。但它停在普吉镇的客运总站1——不停芭东、卡塔、卡伦或拉威，60%以上的游客住在那里。到达HKT前往芭东的游客面临：฿85橙线到客运总站1，然后฿400+双条车或Grab到芭东。总计：约฿500和两次换乘。",
    "정부의 오렌지 라인(노선 8411)은 공항 → 푸껫 타운을 ฿85–100에 운행. 가장 저렴한 공식 옵션. 하지만 푸껫 타운 버스 터미널 1에 정차 — 파통, 카타, 카론, 라와이에는 않음, 관광객 60% 이상이 머무는 곳. HKT에 도착해 파통으로 가는 관광객은: ฿85 오렌지 라인으로 터미널 1, 그리고 ฿400+ 송태우 또는 Grab으로 파통. 합계: ~฿500 및 환승 2회."
  ),
  pbGapBody2: e(
    "PKSB's Airport Line goes directly to Patong for \u0e32100. That is the structural advantage \u2014 and the structural question: can the direct service capture enough of the 17.4M annual HKT passengers to justify the fleet? The USASCP survey found the answer is yes, if the service is reliable, information is clear and the last-mile connection is solved. The engine models exactly that.",
    "สายสนามบินของ PKSB ไปป่าตองโดยตรงในราคา \u0e32100 นั่นคือข้อได้เปรียบเชิงโครงสร้าง \u2014 และคำถามเชิงโครงสร้าง: บริการตรงดึงผู้โดยสาร HKT ปีละ 17.4M ได้พอ justify กองยานพาหนะไหม? การสำรวจ USASCP พบว่าคำตอบคือใช่ ถ้าบริการน่าเชื่อถือ ข้อมูลชัดเจน และการเชื่อมต่อไมล์สุดท้ายได้รับการแก้ เครื่องยนต์จำลองสิ่งนั้น",
    "PKSB的机场线直达芭东，฿100。这是结构性优势——也是结构性问题：直达服务能否吸引足够的1740万年HKT旅客来证明车队的合理性？USASCP调查发现答案是可以，如果服务可靠、信息清晰且最后一英里连接得到解决。引擎正是模拟这一点。",
    "PKSB의 공항 노선은 ฿100에 파통으로 직행. 그것이 구조적 이점 — 그리고 구조적 질문: 직행 서비스가 연간 1740만 HKT 승객 중 충분히 유치하여 차량 대열을 정당화할 수 있는가? USASCP 조사는 답이 '그렇다'고 밝혔습니다, 서비스가 신뢰할 수 있고, 정보가 명확하며, 라스트 마일 연결이 해결된다면. 엔진은 정확히 그것을 모델링합니다."
  ),
  pbPksbLabel: e("PKSB Airport Line", "สายสนามบิน PKSB", "PKSB机场线", "PKSB 공항 노선"),
  pbPksbNote: e("HKT \u2192 Patong direct \u00b7 95 min \u00b7 0 transfers", "HKT \u2192 ป่าตองตรง \u00b7 95 นาที \u00b7 ต่อ 0 ครั้ง", "HKT → 芭东直达 · 95分钟 · 0次换乘", "HKT → 파통 직행 · 95분 · 환승 0회"),
  pbOrangeLabel: e("Orange Line + transfer", "สายส้ม + ต่อรถ", "橙线 + 换乘", "오렌지 라인 + 환승"),
  pbOrangeNote: e("HKT \u2192 Bus Terminal 1 \u2192 songthaew \u2192 Patong \u00b7 ~120 min \u00b7 2 transfers", "HKT \u2192 สถานีขนส่ง 1 \u2192 สองแถว \u2192 ป่าตอง \u00b7 ~120 นาที \u00b7 ต่อ 2 ครั้ง", "HKT → 客运总站1 → 双条车 → 芭东 · 约120分钟 · 2次换乘", "HKT → 버스 터미널 1 → 송태우 → 파통 · ~120분 · 환승 2회"),

  // Research panels
  pbRp1Title: e("Sources: operators, fares, fleet rosters and regulatory bodies", "แหล่งข้อมูล: ผู้ประกอบการ ค่าโดยสาร กองยานพาหนะ และหน่วยงานกำกับ", "来源：运营商、票价、车队和监管机构", "출처: 운영사, 요금, 차량 대열 및 규제 기관"),
  pbRp1Body: e(
    "Fleet rosters (\u0e01\u0e021001\u20131010, \u0e01\u0e042001\u20132007, \u0e01\u0e073001\u20133003) and the Airport Line timetable are from the official PKSB schedule effective 18 January 2025, built into this repository's engine/config.ts. Dragon Line ridership (~230/day) is from the Phuket Provincial Government's 2024 highlights document. Orange Line details are from RTPS and local news reporting. The regulatory structure is summarised from the USASCP toolkit's governance section (pp. 13\u201314).",
    "กองยานพาหนะ (\u0e01\u0e021001\u20131010, \u0e01\u0e042001\u20132007, \u0e01\u0e073001\u20133003) และตารางเวลาสายสนามบินมาจากตาราง PKSB ทางการมีผล 18 มกราคม 2025 สร้างใน engine/config.ts ของพื้นที่เก็บนี้ ผู้โดยสารสายมังกร (~230/วัน) มาจากเอกสารจุดเด่น 2024 ของจังหวัดภูเก็ต รายละเอียดสายส้มจาก RTPS และข่าวท้องถิ่น โครงสร้างกฎระเบียบสรุปจากส่วนกำกับดูแลของชุดเครื่องมือ USASCP (หน้า 13\u201314)",
    "车队（กข 1001–1010、กค 2001–2007、กง 3001–3003）和机场线时刻表来自2025年1月18日生效的官方PKSB时刻表，已构建到本仓库的engine/config.ts中。龙线客流（约230/天）来自普吉省政府2024年亮点文件。橙线详情来自RTPS和当地新闻报道。监管结构摘自USASCP工具包的治理部分（第13–14页）。",
    "차량 대열 (กข 1001–1010, กค 2001–2007, กง 3001–3003) 및 공항 노선 시간표는 2025년 1월 18일 시행 공식 PKSB 일정에서 가져와 이 저장소의 engine/config.ts에 구축됨. 드래곤 라인 승객(~230/일)은 푸껫 성 정부 2024년 하이라이트 문서에서. 오렌지 라인 세부사항은 RTPS 및 지역 뉴스 보도에서. 규제 구조는 USASCP 툴킷의 거버넌스 섹션(pp. 13–14)에서 요약."
  ),
  pbRp2Title: e("The regulatory stack \u2014 DLT, OTP, CMLT and the hotel-stop ban", "ชั้นกฎระเบียบ \u2014 DLT, OTP, CMLT และการห้ามจอดที่โรงแรม", "监管架构——DLT、OTP、CMLT和酒店停车禁令", "규제 체계 — DLT, OTP, CMLT 및 호텔 정차 금지"),
  pbRp2Body: e(
    "Thailand's public transport governance is centralised under the Ministry of Transport. The DLT controls route licensing nationally; the Governor and PAO have implementation but not licensing authority. The hotel-stop ban \u2014 buses may not stop directly at major hotels \u2014 is the most consequential regulatory constraint on capture: it hands door-to-door advantage to taxis and ride-hailing by law, not just by market dynamics. Any PPP or concession structure must address this explicitly.",
    "การกำกับดูแลขนส่งสาธารณะของไทยเป็นส่วนกลางใต้กระทรวงคมนาคม DLT ควบคุมการอนุญาตเส้นทางในระดับชาติ ผู้ว่าและ PAO มีการดำเนินการแต่ไม่มีอำนาจอนุญาต การห้ามจอดที่โรงแรม \u2014 รถบัสห้ามจอดตรงโรงแรมใหญ่ \u2014 เป็นข้อจำกัดกฎระเบียบที่สำคัญที่สุดต่อการดึงผู้โดยสาร: มอบความได้เปรียบถึงประตูให้แท็กซี่และการเรียกรถตามกฎหมาย ไม่ใช่แค่พลวัตตลาด โครงสร้าง PPP หรือสัมปทานใดต้องจัดการสิ่งนี้อย่างชัดเจน",
    "泰国的公共交通治理在交通部下集中管理。DLT在国家层面控制路线许可；府尹和PAO有实施权但没有许可权。酒店停车禁令——巴士不得直接停靠主要酒店——是对客流影响最大的监管约束：它依法将门到门优势交给出租车和打车，而不仅仅是市场动态。任何PPP或特许经营结构都必须明确解决这一问题。",
    "태국의 대중교통 거버넌스는 교통부 산하 중앙집권. DLT가 국가 단위로 노선 허가 통제; 지사와 PAO는 실행권은 있으나 허가권은 없음. 호텔 정차 금지 — 버스가 주요 호텔에 직접 정차 불가 — 승객 유치에 가장 중대한 규제 제약: 법적으로 택시와 차량 호출에 문 앞 이점을 부여, 시장 역학만이 아닌. 모든 PPP 또는 인허가 구조는 이를 명시적으로 다루어야 함."
  ),
};

// ===========================================================================
// PHUKET CONTEXT — the island (header-level translations; body content EN)
// ===========================================================================

export const PC: Record<string, Entry> = {
  pcKicker: e("Chapter 1 \u00b7 The island the bus is for", "บทที่ 1 \u00b7 เกาะที่รถบัสสร้างมาเพื่อ", "第一章 · 为巴士而建的岛屿", "1장 · 버스를 위한 섬"),
  pcTitle: e("Phuket is a 547-square-kilometre argument for public transport.", "ภูเก็ตคือข้อโต้แย้ง 547 ตารางกิโลเมตรเพื่อขนส่งสาธารณะ", "普吉是一个547平方公里的公共交通论据。", "푸껫은 547제곱킬로미터의 대중교통 논증입니다."),
};

// ===========================================================================
// VEGAS DEMAND CASE — header-level translations
// ===========================================================================

export const VEGAS: Record<string, Entry> = {
  vegasKicker: e(
    "Chapter 2 · Las Vegas already answered the demand question",
    "บทที่ 2 · ลาสเวกัสตอบคำถามความต้องการไปแล้ว",
    "第二章 · 拉斯维加斯已经回答了需求问题",
    "2장 · 라스베이거스가 수요 질문에 이미 답했습니다"
  ),
  vegasTitle: e(
    "The Strip had a 4.2-per-100k pedestrian death problem first, a transit agency that measured it second, and a US$650M mistake before the cheap answer worked.",
    "สตริปมีปัญหาคนเดินเท้าเสียชีวิต 4.2 ต่อแสนคนก่อน มีหน่วยงานขนส่งที่วัดผลทีหลัง และผิดพลาดมูลค่า 650 ล้านดอลลาร์ก่อนคำตอบราคาถูกจะได้ผล",
    "大道先有每10万人4.2人的行人死亡问题，再有测量它的交通机构，再有6.5亿美元的错误，然后廉价答案才奏效。",
    "스트립은 먼저 10만 명당 4.2명의 보행자 사망 문제가 있었고, 그다음 측정한 교통 기관이 있었으며, 값싼 답이 통하기 전에 6억 5천만 달러의 실수가 있었습니다."
  ),
};

// ===========================================================================
// COMPARATIVE RESEARCH — header-level translations
// ===========================================================================

export const CR: Record<string, Entry> = {
  crKicker: e(
    "Global benchmarks · the \"cake and eat it\" question",
    "มาตรฐานสากล · คำถาม \"ได้กินเค้กและเก็บไว้ด้วย\"",
    "全球基准 · “鱼和熊掌”问题",
    "글로벌 벤치마크 · “케이크를 먹고도 남기는” 질문"
  ),
  crTitle: e(
    "Seven tourism destinations. One question. The data answers it.",
    "เจ็ดจุดหมายท่องเที่ยว คำถามเดียว ข้อมูลตอบ",
    "七个旅游目的地。一个问题。数据作答。",
    "일곱 관광 목적지. 하나의 질문. 데이터가 답합니다."
  ),
};

// ===========================================================================
// TOOLKIT STUDY — header-level translations
// ===========================================================================

export const STUDY: Record<string, Entry> = {
  studyKicker: e("Build & finance", "สร้างและการเงิน", "建设与融资", "구축 및 재무"),
  studyTitle: e(
    "Method, prototype and the conditional deal.",
    "วิธีการ ต้นแบบ และข้อตกลงมีเงื่อนไข",
    "方法、原型和有条件的交易。",
    "방법론, 프로토타입 및 조건부 거래."
  ),
};

// ===========================================================================
// LEGAL FRAMEWORK — header-level translations
// ===========================================================================

export const LF: Record<string, Entry> = {
  lfKicker: e(
    "PPP, concessions and the politics of approach",
    "PPP สัมปทาน และการเมืองของแนวทาง",
    "PPP、特许经营与路径政治",
    "PPP, 양허, 그리고 접근의 정치"
  ),
  lfTitle: e(
    "Can you have cake and eat it too? Yes — if the contract joins the ledgers.",
    "กินเค้กแล้วเก็บไว้ได้ไหม? ได้ — ถ้าสัญญาเชื่อมบัญชีสองเล่ม",
    "鱼和熊掌可以兼得吗？可以——如果合同把两本账连在一起。",
    "케이크를 먹고도 남길 수 있는가? 가능하다 — 계약이 두 원장을 이으면."
  ),
};

// ===========================================================================
// PROGRAM ARCHIVE — header-level translations
// ===========================================================================

export const PA: Record<string, Entry> = {
  paKicker: e(
    "USASCP Sustainable Mobility Programme · 2022–2026",
    "โปรแกรมการสัญจรที่ยั่งยืน USASCP · 2022–2026",
    "USASCP可持续出行计划 · 2022–2026",
    "USASCP 지속가능 모빌리티 프로그램 · 2022–2026"
  ),
  paTitle: e(
    "Four years. Eight cities. One useful habit: keep going.",
    "สี่ปี แปดเมือง นิสัยที่มีประโยชน์หนึ่งอย่าง: เดินหน้าต่อ",
    "四年。八座城市。一个有用的习惯：继续做下去。",
    "4년. 여덟 도시. 하나의 유용한 습관: 계속 가라."
  ),
};

// ===========================================================================
// COLLABORATION HISTORY — header-level translations
// ===========================================================================

export const CH: Record<string, Entry> = {
  chKicker: e(
    "The collaboration · 2021–2025",
    "ความร่วมมือ · 2021–2025",
    "合作 · 2021–2025",
    "협업 · 2021–2025"
  ),
  chTitle: e(
    "How a diplomatic initiative became a working system.",
    "โครงการทูตกลายเป็นระบบที่ใช้งานได้อย่างไร",
    "一项外交倡议如何变成一套运行中的系统。",
    "외교 이니셔티브가 작동하는 시스템이 된 방식."
  ),
};

// ===========================================================================
// REFERENCES TAB — header-level translations
// ===========================================================================

export const RT: Record<string, Entry> = {
  rtKicker: e(
    "Bibliography · data inventory · reproducibility",
    "บรรณานุกรม · คลังข้อมูล · การทำซ้ำได้",
    "参考文献 · 数据清单 · 可复现性",
    "참고문헌 · 데이터 목록 · 재현성"
  ),
  rtTitle: e(
    "Open the cupboard. Check our ingredients.",
    "เปิดตู้ดู ส่วนผสมของเรา",
    "打开橱柜。核对我们的原料。",
    "찬장을 여십시오. 재료를 확인하십시오."
  ),
};
