// Vercel serverless function entry point — wraps the Express app
import { createApp } from "../server/app.js";

const app = createApp();
export default app;
