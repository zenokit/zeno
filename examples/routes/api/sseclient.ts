import { createSSEClient } from "../../../src/sse/client";
import { initSSE, send, sendEvent, sseClose } from "../../../src/sse/server";
import type { IncomingMessage, ServerResponse } from "http";

export async function GET(req: IncomingMessage, res: ServerResponse) {
  const client = createSSEClient("http://localhost:3000/api/updates");
  initSSE(res);

  const sseClient = await client;
  await sseClient
    .onMessage(data => {
      send(res, data);
    })
    .onEvent("userUpdate", data => {
      sendEvent(res, "userUpdate", data);
    })
    .onClose(() => {
      sseClose(res);
    });
}
