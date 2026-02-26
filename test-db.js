const net = require("net");

const HOST = "82.25.113.249";
const PORT = 3306;

console.log(`Testing TCP connection to ${HOST}:${PORT}...\n`);

const socket = new net.Socket();

const timeoutMs = 5000;

socket.setTimeout(timeoutMs);

socket.on("connect", () => {
  console.log("✅ SUCCESS: Port is OPEN");
  console.log("Your IP is ALLOWED to connect to MySQL");
  socket.destroy();
});

socket.on("timeout", () => {
  console.log("⏱ TIMEOUT: No response from server");
  console.log("Possible firewall silently blocking connection");
  socket.destroy();
});

socket.on("error", (err) => {
  if (err.code === "ECONNREFUSED") {
    console.log("❌ CONNECTION REFUSED");
    console.log("Firewall is actively BLOCKING your IP");
  } else if (err.code === "ETIMEDOUT") {
    console.log("❌ CONNECTION TIMED OUT");
    console.log("Firewall is silently dropping your connection");
  } else {
    console.log("❌ ERROR:", err.message);
  }
});

socket.on("close", () => {
  console.log("\nTest finished.");
});

socket.connect(PORT, HOST);