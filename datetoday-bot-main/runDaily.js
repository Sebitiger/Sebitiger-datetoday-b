import dotenv from "dotenv";
import { postDailyTweet } from "./daily.js";

dotenv.config();

(async () => {
  try {
    console.log("[RunDaily] starting…");
    await postDailyTweet();
    console.log("[RunDaily] done.");
  } catch (err) {
    console.error("[RunDaily] error:", err);
    process.exit(1);
  }
})();
