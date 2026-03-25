import { createApp } from "./app.js";
import { startBackgroundWorker } from "./services/backgroundWorker.js";

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Phuket Smart Bus prototype running on ${port}`);
  const stopWorker = startBackgroundWorker();

  process.on("SIGTERM", () => {
    stopWorker();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    stopWorker();
    process.exit(0);
  });
});
