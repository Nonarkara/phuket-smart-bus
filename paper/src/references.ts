/**
 * The preprint's bibliography. Every entry here was checked against a
 * bibliographic index or the publisher's own record (2026-11-05); entries
 * that could not be confirmed are not in this file. Numbered in order of
 * first citation by `Citations` (Vancouver style), so a reference that the
 * text never cites is never printed.
 */
export type Ref = { key: string; text: string; link: string };

const doi = (d: string) => `https://doi.org/${d}`;

export const REFERENCES: Ref[] = [
  // ── transit service quality and demand ────────────────────────────────────
  { key: "paulley2006", link: doi("10.1016/j.tranpol.2005.12.004"),
    text: "Paulley N, Balcombe R, Mackett R, Titheridge H, Preston J, Wardman M, Shires J, White P. The demand for public transport: the effects of fares, quality of service, income and car ownership. Transport Policy. 2006;13(4):295–306." },
  { key: "currie2008", link: doi("10.1016/j.jtrangeo.2008.04.007"),
    text: "Currie G, Wallis I. Effective ways to grow urban bus markets – a synthesis of evidence. Journal of Transport Geography. 2008;16(6):419–429." },
  { key: "redman2013", link: doi("10.1016/j.tranpol.2012.11.005"),
    text: "Redman L, Friman M, Gärling T, Hartig T. Quality attributes of public transport that attract car users: a research review. Transport Policy. 2013;25:119–127." },
  { key: "litman2004", link: doi("10.5038/2375-0901.7.2.3"),
    text: "Litman T. Transit price elasticities and cross-elasticities. Journal of Public Transportation. 2004;7(2):37–58." },
  { key: "leklahn2015", link: doi("10.1080/13683500.2014.948812"),
    text: "Le-Klähn D-T, Hall CM. Tourist use of public transport at destinations – a review. Current Issues in Tourism. 2015;18(8):785–803." },
  { key: "bursa2022", link: "https://www.sciencedirect.com/science/article/pii/S0965856422002543",
    text: "Bursa B, Mailer M, Axhausen KW. Travel behavior on vacation: transport mode choice of tourists at destinations. Transportation Research Part A: Policy and Practice. 2022;166:234–261." },
  // ── real-time information ─────────────────────────────────────────────────
  { key: "watkins2011", link: doi("10.1016/j.tra.2011.06.010"),
    text: "Watkins KE, Ferris B, Borning A, Rutherford GS, Layton D. Where Is My Bus? Impact of mobile real-time information on the perceived and actual wait time of transit riders. Transportation Research Part A: Policy and Practice. 2011;45(8):839–848." },
  { key: "brakewood2015", link: "https://www.worldtransitresearch.info/research/5519",
    text: "Brakewood C, Macfarlane GS, Watkins K. The impact of real-time information on bus ridership in New York City. Transportation Research Part C: Emerging Technologies. 2015;53:59–75." },
  { key: "tang2012", link: doi("10.1016/j.trc.2012.01.001"),
    text: "Tang L, Thakuriah P. Ridership effects of real-time bus information system: a case study in the City of Chicago. Transportation Research Part C: Emerging Technologies. 2012;22:146–161." },
  // ── reliability, AVL data and headway control ─────────────────────────────
  { key: "furth2006trr", link: "https://trid.trb.org/View/776158",
    text: "Furth PG, Muller THJ. Service reliability and hidden waiting time: insights from automatic vehicle location data. Transportation Research Record. 2006;1955:79–87." },
  { key: "tcrp113", link: doi("10.17226/13907"),
    text: "Furth PG, Hemily B, Muller THJ, Strathman JG. Using archived AVL-APC data to improve transit performance and management. TCRP Report 113. Washington, DC: Transportation Research Board; 2006." },
  { key: "tcqsm3", link: doi("10.17226/24766"),
    text: "Kittelson & Associates, Parsons Brinckerhoff, KFH Group, Texas A&M Transportation Institute, Arup. Transit capacity and quality of service manual. 3rd ed. TCRP Report 165. Washington, DC: Transportation Research Board; 2013." },
  { key: "mazloumi2010", link: doi("10.1061/(ASCE)TE.1943-5436.0000126"),
    text: "Mazloumi E, Currie G, Rose G. Using GPS data to gain insight into public transport travel time variability. Journal of Transportation Engineering. 2010;136(7):623–631." },
  { key: "daganzo2009", link: doi("10.1016/j.trb.2009.04.002"),
    text: "Daganzo CF. A headway-based approach to eliminate bus bunching: systematic analysis and comparisons. Transportation Research Part B: Methodological. 2009;43(10):913–921." },
  { key: "bartholdi2012", link: doi("10.1016/j.trb.2011.11.001"),
    text: "Bartholdi JJ III, Eisenstein DD. A self-coördinating bus route to resist bus bunching. Transportation Research Part B: Methodological. 2012;46(4):481–491." },
  { key: "pelletier2011", link: doi("10.1016/j.trc.2010.12.003"),
    text: "Pelletier M-P, Trépanier M, Morency C. Smart card data use in public transit: a literature review. Transportation Research Part C: Emerging Technologies. 2011;19(4):557–568." },
  { key: "gtfsrt", link: "https://gtfs.org/documentation/realtime/reference/",
    text: "MobilityData. GTFS Realtime reference [Internet]. Retrieved 2026 Nov 5." },
  { key: "marey1885", link: "https://wellcomecollection.org/works/b9bufp7p",
    text: "Marey É-J. La méthode graphique dans les sciences expérimentales et principalement en physiologie et en médecine. Paris: G. Masson; 1885. (The train graph is credited there to the engineer Ibry.)" },
  { key: "tufte1983", link: "https://www.edwardtufte.com/book/the-visual-display-of-quantitative-information/",
    text: "Tufte ER. The visual display of quantitative information. Cheshire, CT: Graphics Press; 1983." },
  // ── rail and bus capital projects ─────────────────────────────────────────
  { key: "flyvbjerg2003", link: doi("10.1080/01441640309904"),
    text: "Flyvbjerg B, Skamris Holm MK, Buhl SL. How common and how large are cost overruns in transport infrastructure projects? Transport Reviews. 2003;23(1):71–88." },
  { key: "flyvbjerg2005", link: doi("10.1080/01944360508976688"),
    text: "Flyvbjerg B, Skamris Holm MK, Buhl SL. How (in)accurate are demand forecasts in public works projects? The case of transportation. Journal of the American Planning Association. 2005;71(2):131–146." },
  { key: "hensher2008", link: doi("10.1007/s11116-008-9163-y"),
    text: "Hensher DA, Golob TF. Bus rapid transit systems: a comparative assessment. Transportation. 2008;35(4):501–518." },
  { key: "deng2011", link: doi("10.1080/01441647.2010.492455"),
    text: "Deng T, Nelson JD. Recent developments in bus rapid transit: a review of the literature. Transport Reviews. 2011;31(1):69–96." },
  { key: "duranton2011", link: doi("10.1257/aer.101.6.2616"),
    text: "Duranton G, Turner MA. The fundamental law of road congestion: evidence from US cities. American Economic Review. 2011;101(6):2616–2652." },
  // ── Phuket and Thailand ───────────────────────────────────────────────────
  { key: "aot2025", link: "https://www.airportthai.co.th/wp-content/uploads/2026/06/ANNUAL-REPORT-2025.pdf",
    text: "Airports of Thailand PCL. Annual report 2025. Bangkok: AOT; 2026." },
  { key: "who2023", link: "https://www.who.int/publications/i/item/9789240086517",
    text: "World Health Organization. Global status report on road safety 2023. Geneva: WHO; 2023." },
  { key: "bkkpost2018ppp", link: "https://www.bangkokpost.com/business/general/1592238/purple-line-phuket-light-rail-among-projects-up-for-ppp",
    text: "Bangkok Post. Purple Line, Phuket light rail among projects up for PPP. 2018 Dec 12." },
  { key: "infoquest2020board", link: "https://www.infoquest.co.th/?p=43572",
    text: "InfoQuest. บอร์ด รฟม.อนุมัติโครงการรถรางภูเก็ต 3.5 หมื่นลบ. คาดเปิดประมูลต้นปี 65 [MRTA board approves ฿35 billion Phuket tram; bidding expected early 2022] [in Thai]. 2020 [cited 2026 Nov 5]." },
  { key: "infoquest2020cabinet", link: "https://www.infoquest.co.th/2020/45734",
    text: "InfoQuest. ครม.รับทราบรถไฟฟ้ารางเบาภูเก็ตมูลค่า 3.5 หมื่นลบ. คาดเปิดประมูล มี.ค.65 [Cabinet acknowledges ฿35 billion Phuket light rail; bidding expected March 2022] [in Thai]. 2020 [cited 2026 Nov 5]." },
  { key: "bkkpost2020art", link: "https://www.bangkokpost.com/business/2015883/ministry-swaps-trams-for-electric-buses-in-phuket",
    text: "Bangkok Post. Ministry swaps trams for electric buses in Phuket. 2020." },
  { key: "nation2024tram", link: "https://www.nationthailand.com/news/policy/40037631",
    text: "The Nation Thailand. Suriya says Phuket tram to run by December 2031 [Internet]. [cited 2026 Nov 5]." },
  { key: "bkkpost2026flawed", link: "https://www.bangkokpost.com/thailand/general/3171763/phuket-mass-transit-plan-flawed",
    text: "Bangkok Post. Phuket mass transit plan ‘flawed’. 2026 Jan 8." },
  { key: "phuketnews2026phiphat", link: "https://www.thephuketnews.com/phiphat-denies-rumours-phuket-mass-transit-project-scrapped-98859.php",
    text: "The Phuket News. Phiphat denies rumours Phuket mass transit project scrapped. 2026 Jan." },
  { key: "mastercard2026", link: "https://newsroom.mastercard.com/news/ap/en/newsroom/press-releases/en/2026/phuket-smart-bus-launches-tap-go-contactless-payments-with-mastercard-and-krungthai-bank/",
    text: "Mastercard. Phuket Smart Bus launches Tap & Go contactless payments with Mastercard and Krungthai Bank [press release]. 2026 Jan 21." },
  { key: "phuketnews2018launch", link: "https://www.thephuketnews.com/phuket-smart-bus-launches-in-style-66152.php",
    text: "The Phuket News. Phuket Smart Bus launches in style. 2018 Feb." },
  { key: "prd2026", link: "https://thailand.prd.go.th/en/content/category/detail/id/48/iid/466841",
    text: "Public Relations Department (Thailand), National News Bureau. Launching of cashless payment system on Phuket Smart Bus in Phuket tourist city [Internet]. 2026 Jan [cited 2026 Nov 5]." },
  { key: "thaiger2024patong", link: "https://thethaiger.com/news/phuket/phuket-launches-b50-electric-bus-service-from-town-to-patong",
    text: "The Thaiger. Phuket launches ฿50 electric bus service from Town to Patong. 2024 Oct." },
  { key: "phuketnews2024dragon", link: "https://mail.thephuketnews.com/phuket-celebrates-launch-of-dragon-line-ev-smart-bus-92509.php",
    text: "The Phuket News. Phuket celebrates launch of Dragon Line EV smart bus. 2024 May." },
  { key: "phuketnews2026roaddeaths", link: "https://thethaiger.com/news/phuket/phuket-records-four-road-deaths-new-year-seven-days-of-danger",
    text: "Thai Road Safety Culture (ThaiRSC) provincial totals for Phuket 2024–2025, as reported in: The Thaiger. Phuket records four road deaths over New Year ‘seven days of danger’ [Internet]. 2026 Jan [cited 2026 Nov 5]." },
  { key: "phuketnews2024vehicles", link: "https://mail.thephuketnews.com/senate-inspects-phuket-traffic-woes-91375.php",
    text: "The Phuket News. Senate inspects Phuket traffic woes. 2024 Feb 23." },
  { key: "tomtom2025", link: "https://www.tomtom.com/traffic-index/bangkok-traffic/",
    text: "TomTom. TomTom Traffic Index 2025: Bangkok [Internet]. Retrieved 2026 Nov 5." },
  { key: "btr1", link: "https://unfccc.int/documents/645098",
    text: "Department of Climate Change and Environment (Thailand). Thailand’s First Biennial Transparency Report (BTR1) under the Paris Agreement. Submitted to the UNFCCC 2024 Dec 26." },
  { key: "thanatrakolsri2024", link: "https://doi.org/10.3390/en17102336",
    text: "Thanatrakolsri P, Sirithian D. Assessing the additional benefits of Thailand’s approaches to reduce motor vehicle emissions. Energies. 2024;17(10):2336." },
  { key: "nilrit2012", link: "https://doi.org/10.5539/mas.v6n8p52",
    text: "Nilrit S, Sampanpanish P. Emission factor of carbon dioxide from in-use vehicles in Thailand. Modern Applied Science. 2012;6(8):52." },
  { key: "choochuay2020", link: "https://doi.org/10.4209/aaqr.2020.03.0120",
    text: "ChooChuay C, Pongpiachan S, Tipmanee D, Deelaman W, Suttinun O, Wang Q, et al. Long-range transboundary atmospheric transport of polycyclic aromatic hydrocarbons, carbonaceous compositions, and water-soluble ionic species in southern Thailand. Aerosol and Air Quality Research. 2020;20:1591–1606." },
  // ── this study's own instruments ──────────────────────────────────────────
  { key: "repo", link: "https://github.com/Nonarkara/phuket-smart-bus",
    text: "Arkaraprasertkul N, et al. phuket-smart-bus: open research record, analysis code and operations console [software]. MIT licence. 2026." },
  { key: "pksbtracker", link: "https://smartbus.phuket.cloud/",
    text: "Phuket City Development Co., Ltd. Phuket Smart Bus public vehicle tracker [Internet]. Retrieved continuously 2026 Sep–Nov." },
];

/** Numbers references in order of first citation; prints only what was cited. */
export class Citations {
  private order: string[] = [];
  private byKey = new Map(REFERENCES.map((r) => [r.key, r]));

  cite(...keys: string[]): string {
    const nums = keys.map((k) => {
      if (!this.byKey.has(k)) throw new Error(`unknown reference key: ${k}`);
      let i = this.order.indexOf(k);
      if (i < 0) { this.order.push(k); i = this.order.length - 1; }
      return i + 1;
    }).sort((a, b) => a - b);
    // Collapse runs: [3, 4, 5] → 3–5.
    const parts: string[] = [];
    for (let i = 0; i < nums.length; i++) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++;
      parts.push(j - i >= 2 ? `${nums[i]}–${nums[j]}` : nums.slice(i, j + 1).join(", "));
      i = j;
    }
    return `[${parts.join(", ")}]`;
  }

  list(): (Ref & { n: number })[] {
    return this.order.map((k, i) => ({ ...this.byKey.get(k)!, n: i + 1 }));
  }
}
