import dotenv from "dotenv";
import { postEveningFact } from "./evening.js";

dotenv.config();

(async () => {
  try {
    console.log("[RunEvening] starting…");
    await postEveningFact();
    console.log("[RunEvening] done.");
  } catch (err) {
    console.error("[RunEvening] error:", err);
    process.exit(1);
  }
})();
