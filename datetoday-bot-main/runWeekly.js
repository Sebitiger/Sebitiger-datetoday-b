import dotenv from "dotenv";
import { postWeeklyThread } from "./weekly.js";

dotenv.config();

(async () => {
  try {
    console.log("[RunWeekly] starting…");
    await postWeeklyThread();
    console.log("[RunWeekly] done.");
  } catch (err) {
    console.error("[RunWeekly] error:", err);
    process.exit(1);
  }
})();
