import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/db.js";
import { getActivityEventsCollection } from "./config/mongo.js";
import { env } from "./config/env.js";

const PORT = env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected successfully");

    try {
      await getActivityEventsCollection();
      console.log("MongoDB connected and event indexes verified");
    } catch (mongoErr: any) {
      console.warn("MongoDB connection warning (service will retry on demand):", mongoErr?.message);
    }

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("Gracefully shutting down...");
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();