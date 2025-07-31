import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import authMiddleware from "./middleware/auth";
import apiRoutes from "./routes/api";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Get allowed origins from environment or use defaults
const allowedOrigins = [
  "http://localhost:5173", // Local development
  "http://localhost:3000", // Alternative local port
  "https://logator-frontend.vercel.app", // Your production frontend
  // Add your custom domain here if you have one
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []), // Production frontend URL from env
].filter((origin): origin is string => Boolean(origin)); // Remove undefined values and ensure type safety

console.log("🌐 CORS Configuration:", { allowedOrigins });

// Temporary: More permissive CORS for debugging
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 4001;

// Middlewares
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// Add debugging middleware for CORS
app.use((req, res, next) => {
  console.log("📥 Incoming request:", {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    userAgent: req.headers["user-agent"]?.substring(0, 50),
  });
  next();
});
app.use(bodyParser.json({ limit: "10mb" })); // Increase limit for base64 images
app.use(bodyParser.urlencoded({ extended: true }));

// JWT Auth Middleware
app.use("/api", authMiddleware);

// Import Socket.IO setter and setup
import { setSocketIO } from "./routes/api";

// Set Socket.IO instance for API routes
setSocketIO(io);

// Mount API routes
app.use("/api", apiRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.send("API server is running.");
});

// Test endpoint for CORS debugging
app.get("/api/test", (req, res) => {
  res.json({
    message: "CORS test successful!",
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers["user-agent"],
  });
});

// Store user socket mappings
const userSockets = new Map<number, string>();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user authentication and socket mapping
  socket.on("authenticate", (data) => {
    if (data.userId) {
      userSockets.set(data.userId, socket.id);
      socket.join(`user_${data.userId}`);
      console.log(`User ${data.userId} authenticated with socket ${socket.id}`);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    // Remove user from socket mapping
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Export io for use in other modules
export { io };

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
});
