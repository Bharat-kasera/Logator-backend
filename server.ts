import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authMiddleware from "./middleware/auth";
import apiRoutes from "./routes/api";

dotenv.config();

const app = express();

// Get allowed origins from environment or use defaults
const allowedOrigins = [
  "http://localhost:5173", // Local development
  "http://localhost:3000", // Alternative local port
  process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean); // Remove undefined values

// Middlewares
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" })); // Built-in JSON parser with increased limit
app.use(express.urlencoded({ extended: true })); // Built-in URL-encoded parser

// JWT Auth Middleware
app.use("/api", authMiddleware);

// Mount API routes
app.use("/api", apiRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.send("API server is running.");
});

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4001;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

// Export the app for Vercel
export default app;
