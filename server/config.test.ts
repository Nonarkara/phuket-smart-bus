afterEach(() => {
  vi.resetModules();
  delete process.env.DATA_MODE;
  delete process.env.SMARTBUS_BEARER_TOKEN;
  delete process.env.PKSB_INGEST_API_KEY;
});

describe("assertRuntimeConfig", () => {
  it("does not require live secrets in demo mode", async () => {
    process.env.DATA_MODE = "demo";

    const { assertRuntimeConfig } = await import("./config.js");

    expect(() => assertRuntimeConfig()).not.toThrow();
  });

  it("fails fast in live mode when required secrets are missing", async () => {
    process.env.DATA_MODE = "live";
    delete process.env.SMARTBUS_BEARER_TOKEN;
    delete process.env.PKSB_INGEST_API_KEY;

    const { assertRuntimeConfig } = await import("./config.js");

    expect(() => assertRuntimeConfig()).toThrow(
      /Missing required live-mode configuration: SMARTBUS_BEARER_TOKEN, PKSB_INGEST_API_KEY/
    );
  });
});
