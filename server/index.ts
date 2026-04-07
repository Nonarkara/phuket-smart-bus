import { createApp } from "./app.js";
import { assertRuntimeConfig } from "./config.js";

const port = Number(process.env.PORT ?? 3001);
assertRuntimeConfig();
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Phuket Smart Bus prototype running on ${port}`);
});
