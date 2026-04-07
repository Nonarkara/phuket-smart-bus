import { assertRuntimeConfig } from "./config.js";
import { startBackgroundWorker } from "./services/backgroundWorker.js";

assertRuntimeConfig();

const stopWorker = startBackgroundWorker();

process.on("SIGTERM", () => {
  stopWorker();
  process.exit(0);
});

process.on("SIGINT", () => {
  stopWorker();
  process.exit(0);
});
