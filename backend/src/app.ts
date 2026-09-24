import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

import authRoutes from "./routes/auth.routes.js";
import studentRoutes from "./routes/student.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();

// Request ID assignment
app.use((req, res, next) => {
  const reqId = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = reqId;
  res.setHeader("x-request-id", reqId);
  next();
});

const allowedStaticOrigins = [
  "http://localhost:5173",
  "http://localhost:5187",
  "http://localhost:3000",
  "http://localhost:4173",
];

const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim().replace(/\/$/, ""))
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      let hostname = "";
      try {
        hostname = new URL(origin).hostname;
      } catch {
        hostname = "";
      }

      const isAllowed =
        allowedStaticOrigins.includes(normalizedOrigin) ||
        configuredOrigins.includes(normalizedOrigin) ||
        (hostname !== "" &&
          (/\.netlify\.app$/.test(hostname) ||
            hostname === "netlify.app" ||
            hostname.endsWith(".onrender.com")));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-refresh-token",
      "Idempotency-Key",
    ],
    exposedHeaders: ["x-request-id"],
  })
);

app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Application routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);

// Fallback 404 and global error handler
app.use(notFound);
app.use(errorHandler);

export default app;