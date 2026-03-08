import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./components/LiveMap", () => ({
  LiveMap: () => <div data-testid="live-map">map</div>
}));

const routes = [
  {
    id: "rawai-airport",
    name: { en: "Rawai - Phuket Airport", th: "ราไวย์ - สนามบินภูเก็ต" },
    shortName: { en: "Airport Line", th: "สายสนามบิน" },
    overview: {
      en: "Airport corridor",
      th: "คอร์ริดอร์สนามบิน"
    },
    axis: "north_south",
    axisLabel: {
      en: "North-south corridor",
      th: "แนวเส้นทางเหนือใต้"
    },
    tier: "core",
    color: "#16b8b0",
    accentColor: "#e8fff9",
    bounds: [
      [7.7, 98.2],
      [8.1, 98.4]
    ],
    pathSegments: [],
    stopCount: 2,
    defaultStopId: "rawai-airport-42",
    activeVehicles: 3,
    status: {
      en: "3 buses reporting live",
      th: "มีรถออนไลน์ 3 คัน"
    },
    sourceStatus: {
      source: "bus",
      state: "live",
      updatedAt: "2026-03-08T14:00:00Z",
      detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
    }
  }
];

const stops = [
  {
    id: "rawai-airport-42",
    routeId: "rawai-airport",
    sequence: 42,
    name: { en: "Phuket Airport", th: "สนามบินภูเก็ต" },
    direction: { en: "Bus to Rawai", th: "รถไปราไวย์" },
    routeDirection: {
      en: "Airport to Rawai",
      th: "สนามบินไปราไวย์"
    },
    coordinates: [8.1, 98.3],
    scheduleText: "05:37AM,06:37AM",
    nextBus: {
      label: "3:05 PM",
      minutesUntil: 9,
      basis: "schedule",
      notes: { en: "Schedule based", th: "อิงตารางเวลา" }
    },
    timetable: {
      firstDepartureLabel: "5:37 AM",
      lastDepartureLabel: "6:37 AM",
      nextDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
      serviceWindowLabel: "5:37 AM - 6:37 AM",
      sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ" },
      sourceUrl: "https://example.com/timetable",
      sourceUpdatedAt: "2025-01-18",
      notes: { en: "Official schedule", th: "ตารางทางการ" }
    },
    nearbyPlace: {
      name: "Terminal hall",
      mapUrl: "https://example.com",
      openingHours: "24 hours",
      distanceMeters: 100,
      walkMinutes: 2
    }
  }
];

const advisories = {
  advisories: [
    {
      id: "adv-1",
      routeId: "rawai-airport",
      source: "itic",
      severity: "caution",
      title: {
        en: "Airport approach is slower",
        th: "ทางเข้าสนามบินช้าลง"
      },
      message: {
        en: "Traffic is denser than baseline.",
        th: "การจราจรหนาแน่นกว่าปกติ"
      },
      recommendation: {
        en: "Leave 10 minutes earlier.",
        th: "เผื่อเวลาเพิ่ม 10 นาที"
      },
      updatedAt: "2026-03-08T14:00:00Z",
      active: true,
      tags: ["airport"]
    }
  ]
};

const decision = {
  routeId: "rawai-airport",
  stopId: "rawai-airport-42",
  level: "leave_early",
  headline: {
    en: "Leave a bit early",
    th: "ออกเร็วขึ้นเล็กน้อย"
  },
  summary: {
    en: "Service is usable, but small delays matter.",
    th: "รถยังใช้ได้ แต่ความล่าช้าเล็กน้อยมีผล"
  },
  reasons: [
    { en: "3 live vehicles are visible on this route.", th: "มีรถสด 3 คันบนเส้นทางนี้" }
  ],
  nextBus: {
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "schedule",
    notes: { en: "Schedule based", th: "อิงตารางเวลา" }
  },
  seatAvailability: {
    seatsLeft: 11,
    capacity: 23,
    occupiedSeats: 12,
    loadFactor: 12 / 23,
    basis: "camera_ready_estimate",
    cameraId: null,
    confidenceLabel: {
      en: "Estimated until the seat camera feed is connected.",
      th: "เป็นค่าประมาณจนกว่าจะเชื่อมต่อกล้องนับที่นั่ง"
    },
    passengerFlow: {
      boardingsRecent: 4,
      alightingsRecent: 1,
      updatedAt: "2026-03-08T14:00:00Z"
    },
    driverAttention: {
      state: "alert",
      cameraId: "driver-01",
      confidence: 0.94,
      label: {
        en: "Driver alert",
        th: "คนขับพร้อม"
      },
      updatedAt: "2026-03-08T14:00:00Z"
    },
    updatedAt: "2026-03-08T14:00:00Z"
  },
  timetable: {
    firstDepartureLabel: "5:37 AM",
    lastDepartureLabel: "6:37 AM",
    nextDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
    serviceWindowLabel: "5:37 AM - 6:37 AM",
    sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ" },
    sourceUrl: "https://example.com/timetable",
    sourceUpdatedAt: "2025-01-18",
    notes: { en: "Official schedule", th: "ตารางทางการ" }
  },
  liveVehicles: 3,
  routeStatus: {
    en: "Live service with rider caution",
    th: "มีรถสดแต่ควรเผื่อเวลา"
  },
  updatedAt: "2026-03-08T14:00:00Z",
  sourceStatuses: [
    {
      source: "bus",
      state: "live",
      updatedAt: "2026-03-08T14:00:00Z",
      detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
    }
  ]
};

const airportGuide = {
  destinationQuery: "",
  recommendation: "ready",
  headline: {
    en: "A bus is running from the airport",
    th: "มีรถบัสวิ่งออกจากสนามบิน"
  },
  summary: {
    en: "Search a beach, hotel belt, or landmark and we will tell you if Smart Bus is the right choice before you leave the terminal.",
    th: "พิมพ์ชื่อหาด ย่านโรงแรม หรือจุดสังเกต แล้วเราจะบอกว่าควรเลือก Smart Bus ก่อนออกจากอาคารหรือไม่"
  },
  bestMatch: null,
  matches: [],
  nextDeparture: {
    routeId: "rawai-airport",
    routeName: { en: "Airport Line", th: "สายสนามบิน" },
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "schedule",
    state: "scheduled",
    liveBusId: null,
    liveLicensePlate: null,
    seats: {
      seatsLeft: 11,
      capacity: 23,
      occupiedSeats: 12,
      loadFactor: 12 / 23,
      basis: "camera_live",
      cameraId: "cabin-01",
      confidenceLabel: {
        en: "Live seats from the bus camera feed.",
        th: "จำนวนที่นั่งสดจากกล้องบนรถ"
      },
      passengerFlow: {
        boardingsRecent: 4,
        alightingsRecent: 1,
        updatedAt: "2026-03-08T14:00:00Z"
      },
      driverAttention: {
        state: "alert",
        cameraId: "driver-01",
        confidence: 0.96,
        label: {
          en: "Driver alert",
          th: "คนขับพร้อม"
        },
        updatedAt: "2026-03-08T14:00:00Z"
      },
      updatedAt: "2026-03-08T14:00:00Z"
    }
  },
  followingDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
  airportBoardingLabel: {
    en: "Board opposite Cafe Amazon",
    th: "ขึ้นรถฝั่งตรงข้าม Cafe Amazon"
  },
  boardingNotes: [
    {
      en: "Go to exit 3 and wait opposite Cafe Amazon for the Smart Bus stop.",
      th: "ไปที่ทางออก 3 แล้วรอที่ป้าย Smart Bus ฝั่งตรงข้าม Cafe Amazon"
    }
  ],
  quickDestinations: [
    {
      id: "patong",
      label: { en: "Patong", th: "ป่าตอง" },
      routeId: "rawai-airport",
      stopId: "rawai-airport-42",
      kind: "direct",
      travelMinutes: 46
    }
  ],
  sourceStatuses: decision.sourceStatuses,
  checkedAt: "2026-03-08T14:00:00Z"
};

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");

    const mockFetch = vi.fn((input: string | URL) => {
        const url = String(input);

        if (url.endsWith("/api/routes")) {
          return Promise.resolve(new Response(JSON.stringify(routes)));
        }

        if (url.endsWith("/api/health")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                status: "ok",
                checkedAt: "2026-03-08T14:00:00Z",
                sources: decision.sourceStatuses
              })
            )
          );
        }

        if (url.includes("/api/routes/rawai-airport/stops")) {
          return Promise.resolve(new Response(JSON.stringify(stops)));
        }

        if (url.includes("/api/routes/rawai-airport/vehicles")) {
          return Promise.resolve(new Response(JSON.stringify({ vehicles: [] })));
        }

        if (url.includes("/api/routes/rawai-airport/advisories")) {
          return Promise.resolve(new Response(JSON.stringify(advisories)));
        }

        if (url.includes("/api/airport-guide")) {
          return Promise.resolve(new Response(JSON.stringify(airportGuide)));
        }

        if (url.includes("/api/decision-summary")) {
          return Promise.resolve(new Response(JSON.stringify(decision)));
        }

        return Promise.reject(new Error(`Unhandled ${url}`));
      });

    vi.stubGlobal("fetch", mockFetch);
    window.fetch = mockFetch as typeof window.fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the rider prototype and switches language", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Can the bus take me there?" })).toBeInTheDocument();
    expect(await screen.findByText("A bus is running from the airport")).toBeInTheDocument();
    expect(await screen.findByText("12 seated · 4 on · 1 off")).toBeInTheDocument();
    expect(await screen.findByText("Driver alert · 96% confidence")).toBeInTheDocument();
    expect(screen.queryByText("Airport approach is slower")).not.toBeInTheDocument();
    expect(screen.queryByTestId("live-map")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "My stop" }));

    expect(await screen.findByText("Airport approach is slower")).toBeInTheDocument();
    expect(screen.getByText("12 seated")).toBeInTheDocument();
    expect(screen.getByText("4 on · 1 off")).toBeInTheDocument();
    expect(screen.queryByTestId("live-map")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Live map" }));

    expect(screen.getByTestId("live-map")).toBeInTheDocument();
    expect(screen.getByText("North-south corridor")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "TH" }));
    await userEvent.click(screen.getByRole("button", { name: "สนามบิน" }));

    expect(screen.getByRole("heading", { name: "รถบัสไปถึงที่นั่นไหม?" })).toBeInTheDocument();
    expect(screen.getByText("มีรถบัสวิ่งออกจากสนามบิน")).toBeInTheDocument();
  });
});
