// // src/index.ts
// import dns from "dns";
// import "reflect-metadata";
// import "dotenv/config";
// import app from "./app";
// import { AppDataSource } from "./data-source";

// dns.setDefaultResultOrder("ipv4first");

// const PORT = Number(process.env.PORT) || 4000;


// async function startServer() {
//   try {
//     if (!AppDataSource.isInitialized) {
//       console.log("🔄 Initializing DB (local)...");
//       await AppDataSource.initialize();
//       console.log("✅ DB initialized (local)");
//     }

//     app.listen(PORT, () => {
//       console.log(`🚀 Local server running on http://localhost:${PORT}`);
//     });
//   } catch (error) {
//     console.error("❌ Failed to start local server:", error);
//     process.exit(1);
//   }
// }

// startServer();


// src/index.ts
import dns from "dns";
import os from "os";
import https from "https";
import "reflect-metadata";
import "dotenv/config";
import app from "./app";
import { AppDataSource } from "./data-source";

dns.setDefaultResultOrder("ipv4first");

const PORT = Number(process.env.PORT) || 4000;

// Get local network IPv4
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;

    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "localhost";
}

// Get public IPv4
function getPublicIP(): Promise<string> {
  return new Promise((resolve) => {
    https
      .get("https://api.ipify.org?format=json", (res) => {
        let data = "";

        res.on("data", (chunk) => (data += chunk));

        res.on("end", () => {
          try {
            const ip = JSON.parse(data).ip;
            resolve(ip);
          } catch {
            resolve("unavailable");
          }
        });
      })
      .on("error", () => resolve("unavailable"));
  });
}

async function startServer() {
  try {
    if (!AppDataSource.isInitialized) {
      console.log("🔄 Initializing DB (local)...");
      await AppDataSource.initialize();
      console.log("✅ DB initialized (local)");
    }

    const localIP = getLocalIP();

    app.listen(PORT, "0.0.0.0", async () => {
      console.log("\n🚀 Server running:");
      console.log(`   ➜ Local:    http://localhost:${PORT}`);
      console.log(`   ➜ Network:  http://${localIP}:${PORT}`);

      const publicIP = await getPublicIP();
      console.log(`   ➜ Public:   http://${publicIP}:${PORT}`);
      console.log("");
    });
  } catch (error) {
    console.error("❌ Failed to start local server:", error);
    process.exit(1);
  }
}

startServer();