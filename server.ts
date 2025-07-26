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
  process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean); // Remove undefined values

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
    credentials: true,
  })
);
app.use(bodyParser.json({ limit: "10mb" })); // Increase limit for base64 images
app.use(bodyParser.urlencoded({ extended: true }));

// JWT Auth Middleware
app.use("/api", authMiddleware);

// Mount API routes
app.use("/api", apiRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.send("API server is running.");
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Socket.IO server is ready`);
});
