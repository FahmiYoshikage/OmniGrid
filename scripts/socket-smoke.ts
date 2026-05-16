import { io } from "socket.io-client";

const sock = io("http://localhost:3000/ssh", { transports: ["websocket"] });
const timeout = setTimeout(() => {
  console.error("TIMEOUT");
  process.exit(1);
}, 5000);

sock.on("connect", () => {
  console.log("connected to /ssh, id:", sock.id);
  // Try to open a session against a non-existent node — expect ack with ok:false
  sock.emit("open", { nodeId: "does-not-exist", cols: 80, rows: 24 }, (ack: { ok: boolean; error?: string }) => {
    console.log("open ack:", ack);
    clearTimeout(timeout);
    sock.close();
    process.exit(ack.ok ? 1 : 0); // expect ok:false
  });
});
sock.on("connect_error", (e) => {
  console.error("connect_error:", e.message);
  process.exit(1);
});
