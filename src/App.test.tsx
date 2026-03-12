import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./components/LiveMap", () => ({
  LiveMap: ({
    routes,
    mode,
    userLocation,
    selectedStop,
    highlightStopIds,
    highlightVehicleId,
    testId = "live-map",
    onModeChange
  }: {
    routes: Array<{ id: string }>;
    mode: "route" | "stop";
    userLocation: [number, number] | null;
    selectedStop: { id: string } | null;
    highlightStopIds?: string[];
    highlightVehicleId?: string | null;
    testId?: string;
    onModeChange: (mode: "route" | "stop") => void;
  }) => (
    <div data-testid={testId}>
      <div>{`routes:${routes.map((route) => route.id).join(",")}`}</div>
      <div>{`mode:${mode}`}</div>
      <div>{userLocation ? "user-location:on" : "user-location:off"}</div>
      <div>{selectedStop ? `selected-stop:${selectedStop.id}` : "selected-stop:none"}</div>
      <div>{`highlight-stop:${(highlightStopIds ?? []).join(",") || "none"}`}</div>
      <div>{`highlight-vehicle:${highlightVehicleId ?? "none"}`}</div>
      <button type="button" onClick={() => onModeChange("route")}>
        mock-route-view
      </button>
      <button type="button" onClick={() => onModeChange("stop")}>
        mock-stop-focus
      </button>
    </div>
  )
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
  },
  {
    id: "patong-old-bus-station",
    name: { en: "Patong - Terminal 1", th: "ป่าตอง - บขส.1" },
    shortName: { en: "Patong Line", th: "สายป่าตอง" },
    overview: {
      en: "City corridor",
      th: "คอร์ริดอร์ในเมือง"
    },
    axis: "east_west",
    axisLabel: {
      en: "East-west corridor",
      th: "แนวเส้นทางตะวันออกตะวันตก"
    },
    tier: "core",
    color: "#ffcc33",
    accentColor: "#fff8dc",
    bounds: [
      [7.84, 98.28],
      [7.91, 98.41]
    ],
    pathSegments: [],
    stopCount: 2,
    defaultStopId: "patong-old-bus-station-1",
    activeVehicles: 2,
    status: {
      en: "2 buses reporting live",
      th: "มีรถออนไลน์ 2 คัน"
    },
    sourceStatus: {
      source: "bus",
      state: "live",
      updatedAt: "2026-03-08T14:00:00Z",
      detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
    }
  }
];

const airportStops = [
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

const patongStops = [
  {
    id: "patong-old-bus-station-1",
    routeId: "patong-old-bus-station",
    sequence: 1,
    name: { en: "Patong Beach", th: "หาดป่าตอง" },
    direction: { en: "Bus to Terminal 1", th: "รถไป บขส.1" },
    routeDirection: {
      en: "Patong to Terminal 1",
      th: "ป่าตองไป บขส.1"
    },
    coordinates: [7.895, 98.298],
    scheduleText: "05:37AM,06:37AM",
    nextBus: {
      label: "3:11 PM",
      minutesUntil: 15,
      basis: "schedule",
      notes: { en: "Schedule based", th: "อิงตารางเวลา" }
    },
    timetable: {
      firstDepartureLabel: "5:37 AM",
      lastDepartureLabel: "6:37 AM",
      nextDepartures: ["3:11 PM", "4:11 PM", "5:11 PM"],
      serviceWindowLabel: "5:37 AM - 6:37 AM",
      sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ" },
      sourceUrl: "https://example.com/timetable",
      sourceUpdatedAt: "2025-01-18",
      notes: { en: "Official schedule", th: "ตารางทางการ" }
    },
    nearbyPlace: {
      name: "Patong Beachfront",
      mapUrl: "https://example.com/patong",
      openingHours: "Always open",
      distanceMeters: 120,
      walkMinutes: 2
    }
  }
];

const airportVehicles = [{ id: "veh-airport-1" }];
const patongVehicles = [{ id: "veh-patong-1" }];

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
  fareComparison: {
    busFareThb: 100,
    taxiFareEstimateThb: 1000,
    savingsThb: 900,
    savingsCopy: {
      en: "Save about 900 THB versus a typical airport taxi ride.",
      th: "ประหยัดได้ประมาณ 900 บาทเมื่อเทียบกับแท็กซี่จากสนามบินทั่วไป"
    }
  },
  boardingWalk: {
    primaryInstruction: {
      en: "Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.",
      th: "เมื่อออกมาด้านนอกแล้วให้เลี้ยวซ้ายและเดินไปที่ป้าย Smart Bus ข้าง Cafe Amazon"
    },
    secondaryInstruction: {
      en: "Use exit 3, cross to the Cafe Amazon side, and stay under cover if rain starts.",
      th: "ใช้ทางออก 3 ข้ามไปฝั่ง Cafe Amazon และหลบฝนใต้ที่กำบังหากฝนเริ่มตก"
    },
    focusStopId: "rawai-airport-42"
  },
  weatherSummary: {
    conditionLabel: {
      en: "Rain moving across the airport corridor",
      th: "มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน"
    },
    currentPrecipitation: 1.8,
    maxRainProbability: 82,
    recommendation: {
      en: "Keep a small buffer in case rain or wind slows boarding at the airport stop.",
      th: "ควรเผื่อเวลาเล็กน้อยในกรณีที่ฝนหรือลมทำให้การขึ้นรถที่ป้ายสนามบินช้าลง"
    },
    severity: "caution"
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
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: 8.1,
              longitude: 98.3,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({})
            },
            timestamp: Date.now(),
            toJSON: () => ({})
          } as GeolocationPosition)
        )
      }
    });

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
          return Promise.resolve(new Response(JSON.stringify(airportStops)));
        }

        if (url.includes("/api/routes/rawai-airport/vehicles")) {
          return Promise.resolve(new Response(JSON.stringify({ vehicles: airportVehicles })));
        }

        if (url.includes("/api/routes/rawai-airport/advisories")) {
          return Promise.resolve(new Response(JSON.stringify(advisories)));
        }

        if (url.includes("/api/routes/patong-old-bus-station/stops")) {
          return Promise.resolve(new Response(JSON.stringify(patongStops)));
        }

        if (url.includes("/api/routes/patong-old-bus-station/vehicles")) {
          return Promise.resolve(new Response(JSON.stringify({ vehicles: patongVehicles })));
        }

        if (url.includes("/api/routes/patong-old-bus-station/advisories")) {
          return Promise.resolve(new Response(JSON.stringify({ advisories: [] })));
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

    expect(await screen.findByRole("heading", { name: "Bus or taxi?" })).toBeInTheDocument();
    expect(await screen.findByText("You appear to be at Phuket Airport")).toBeInTheDocument();
    expect(await screen.findByText("100 THB")).toBeInTheDocument();
    expect(await screen.findByText(/1,000/)).toBeInTheDocument();
    expect(await screen.findByText("Save about 900 THB versus a typical airport taxi ride.")).toBeInTheDocument();
    expect((await screen.findAllByText("Rain moving across the airport corridor")).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(
        "Keep a small buffer in case rain or wind slows boarding at the airport stop."
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.")).toBeInTheDocument();
    expect(await screen.findByText("Phuket time")).toBeInTheDocument();
    expect(screen.getByText("UTC+7 boarding clock", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My QR" })).toBeInTheDocument();
    expect(screen.getByTestId("airport-map-preview")).toBeInTheDocument();
    expect(screen.getByText("highlight-stop:rawai-airport-42")).toBeInTheDocument();
    expect(screen.queryByText("Airport approach is slower")).not.toBeInTheDocument();
    expect(screen.getByText("A mock-up for rider testing and future GPS and camera integration.")).toBeInTheDocument();
    expect(screen.getByText("Copyright 2026 Dr. Non Arkaraprasertkul")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "My stop" }));

    expect(await screen.findByText("Airport approach is slower")).toBeInTheDocument();
    expect(screen.getByText("12 seated")).toBeInTheDocument();
    expect(screen.getByText("4 on · 1 off")).toBeInTheDocument();
    expect(screen.queryByTestId("live-map")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Live map" }));

    expect(screen.getByTestId("live-map")).toBeInTheDocument();
    expect(screen.getByText("North-south corridor")).toBeInTheDocument();
    expect(await screen.findByText("routes:rawai-airport,patong-old-bus-station")).toBeInTheDocument();
    expect(screen.getByText("mode:route")).toBeInTheDocument();
    expect(screen.getByText("user-location:on")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "mock-stop-focus" }));

    expect(await screen.findByText("mode:stop")).toBeInTheDocument();
    expect(screen.getByText("routes:rawai-airport")).toBeInTheDocument();
    expect(screen.getByText("selected-stop:rawai-airport-42")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "mock-route-view" }));
    await userEvent.click(screen.getByRole("button", { name: /Patong Line/i }));

    expect(await screen.findByText("routes:patong-old-bus-station")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "My QR" }));

    expect(await screen.findByRole("heading", { name: "My QR code" })).toBeInTheDocument();
    expect(screen.getAllByText("24h pass")).toHaveLength(2);
    expect(screen.getByText("7-day pass")).toBeInTheDocument();
    expect(screen.getByText("Time left")).toBeInTheDocument();
    expect(screen.getByText("QR boarding code")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "7-day pass" }));

    expect(screen.getAllByText("7-day pass")).toHaveLength(2);
    expect(screen.getByText("PKSB-WEEK-7-1124")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "TH" }));
    await userEvent.click(screen.getByRole("button", { name: "สนามบิน" }));

    expect(screen.getByRole("heading", { name: "รถบัสหรือแท็กซี่?" })).toBeInTheDocument();
    expect(screen.getByText("100 THB")).toBeInTheDocument();
    expect(screen.getByText("ดูเหมือนว่าคุณอยู่ที่สนามบินภูเก็ต")).toBeInTheDocument();
    expect(screen.getAllByText("มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน").length).toBeGreaterThan(0);
    expect(screen.getByText("เวลาภูเก็ต")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "คิวอาร์ของฉัน" })).toBeInTheDocument();
  });
});
