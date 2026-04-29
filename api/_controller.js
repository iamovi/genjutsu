import { readFile } from "node:fs/promises";
import path from "node:path";

const CONTROLLER_PATH = path.join(process.cwd(), "controller", "main.json");

const defaults = {
  maintenance: false,
  maintenanceMessage: "",
  readOnlyMode: false,
  apiOff: false,
  feedApiOff: false,
  botRenderApiOff: false,
};

export async function getControllerSettings() {
  try {
    const raw = await readFile(CONTROLLER_PATH, "utf8");
    const data = JSON.parse(raw);
    return {
      maintenance: Boolean(data?.maintenance),
      maintenanceMessage: typeof data?.maintenanceMessage === "string" ? data.maintenanceMessage : "",
      readOnlyMode: Boolean(data?.readOnlyMode),
      apiOff: Boolean(data?.apiOff),
      feedApiOff: Boolean(data?.feedApiOff),
      botRenderApiOff: Boolean(data?.botRenderApiOff),
    };
  } catch {
    return defaults;
  }
}
