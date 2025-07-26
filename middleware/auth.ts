import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWTPayload } from "../types";

// Public routes that don't require authentication
// Note: paths are relative to /api since middleware is mounted on /api
const publicRoutes = [
  "/register",
  "/verify-otp",
  "/login-otp-verify",
  "/send-otp",
  "/check-user",
  "/check-user-exists",
  "/otp/send-otp",
  "/otp/verify-otp",
];

const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.log("🔍 AUTH MIDDLEWARE:", {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    isPublicRoute: publicRoutes.includes(req.path),
    publicRoutes: publicRoutes,
  });

  // Skip authentication for public routes
  if (publicRoutes.includes(req.path)) {
    console.log("✅ SKIPPING AUTH for public route:", req.path);
    next();
    return;
  }

  console.log("🔒 CHECKING AUTH for protected route:", req.path);
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("❌ UNAUTHORIZED: No Bearer token found");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = payload; // must have id & plan in token
    console.log("✅ AUTH SUCCESS for user:", payload.id);
    next();
  } catch (err) {
    console.log("❌ INVALID TOKEN:", err);
    res.status(401).json({ message: "Invalid token" });
    return;
  }
};

export default authMiddleware;
