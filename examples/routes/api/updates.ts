import { initSSE, send, sendEvent, sseClose } from "../../../src/sse/server";
import type { IncomingMessage, ServerResponse } from "http";

export async function GET(req: IncomingMessage, res: ServerResponse) {
  initSSE(res);
  
  console.log("Sending regular updates");
  send(res, { status: "connected" });
  
  sendEvent(res, "userUpdate", { id: 1, name: "John" });
  sseClose(res);

}