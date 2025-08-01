import express, { Request, Response } from "express";
import { Pool } from "pg";
import jwt from "jsonwebtoken";
import { RegisterRequest, LoginRequest, User } from "../types";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Registration: check for duplicate and insert user directly (no OTP)
router.post(
  "/register",
  async (
    req: Request<{}, any, RegisterRequest>,
    res: Response
  ): Promise<void> => {
    console.log("🎯 REGISTER ROUTE HIT!");
    console.log("📥 Request body:", req.body);
    console.log("📋 Headers:", req.headers);

    const {
      phone,
      email,
      firstName,
      lastName,
      country_code,
      photo,
      representing,
    } = req.body;

    console.log("Received at /api/register:", req.body);

    if (!phone || !firstName) {
      res.status(400).json({ message: "Phone and first name are required." });
      return;
    }

    try {
      // Check for duplicate (country_code, phone) pair
      const { rows } = await pool.query(
        "SELECT id FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phone]
      );

      if (rows.length > 0) {
        res.status(409).json({
          message:
            "This country code and phone number combination is already registered.",
        });
        return;
      }

      // Insert user directly
      const insertResult = await pool.query(
        `INSERT INTO users (phone, email, firstname, lastname, country_code, photo_url, plan, representing)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, phone, email, firstname, lastname, country_code, photo_url, plan, representing, created_at`,
        [
          phone,
          email || null,
          firstName,
          lastName || null,
          country_code || null,
          photo || null,
          1,
          representing || null,
        ]
      );

      const user: User = insertResult.rows[0];

      // Set createdby = id
      await pool.query("UPDATE users SET createdby = $1 WHERE id = $1", [
        user.id,
      ]);

      // Create company from representing field if provided
      if (representing && representing.trim()) {
        try {
          await pool.query(
            `INSERT INTO companies (user_id, name, uuid, created_at, updated_at)
             VALUES ($1, $2, uuid_generate_v4(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [user.id, representing.trim()]
          );
          console.log(`Company '${representing.trim()}' created for user ${user.id}`);
        } catch (companyErr: any) {
          console.log("⚠️ Warning: Failed to create company:", companyErr.message);
          // Continue with user registration even if company creation fails
        }
      }

      console.log("User registered successfully:", user);
      res.status(201).json({
        message: "User registered successfully.",
        user: { ...user, createdby: user.id },
      });
    } catch (err: any) {
      console.log("💥 REGISTER DATABASE ERROR:", err);
      console.log("💥 Error details:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      res.status(500).json({
        message: "Server error",
        error: err.message,
        code: err.code,
      });
    }
  }
);

// OTP verification and user creation (legacy route)
router.post(
  "/verify-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { phone, otp, email, firstName, lastName, country_code, photo } =
      req.body;

    console.log("Received at /api/verify-otp:", req.body);

    if (!phone || !otp) {
      res.status(400).json({ message: "Phone and OTP are required." });
      return;
    }

    // TESTING MODE: Hardcoded OTP check (Twilio commented out for testing)
    if (otp !== "123456") {
      res.status(400).json({ message: "Invalid OTP. Use 123456 for testing." });
      return;
    }
    console.log("🔍 TESTING MODE: OTP verified successfully for registration:", phone);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Insert user and return id
      const insertResult = await client.query(
        `INSERT INTO users (phone, email, firstname, lastname, country_code, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, phone, email, firstname, lastname, country_code, photo_url, created_at`,
        [
          phone,
          email || null,
          firstName,
          lastName || null,
          country_code || null,
          photo || null,
        ]
      );

      const user: User = insertResult.rows[0];

      // Set createdby = id
      await client.query("UPDATE users SET createdby = $1 WHERE id = $1", [
        user.id,
      ]);
      await client.query("COMMIT");

      res.status(201).json({
        message: "User registered successfully.",
        user: { ...user, createdby: user.id },
      });
    } catch (err: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ message: "Server error", error: err.message });
    } finally {
      client.release();
    }
  }
);

// Check if user exists by country_code and phone
router.post(
  "/check-user",
  async (req: Request, res: Response): Promise<void> => {
    const { country_code, phone } = req.body;

    if (!country_code || !phone) {
      res.status(200).json({ exists: false });
      return;
    }

    try {
      const { rows } = await pool.query(
        "SELECT id FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phone]
      );
      res.status(200).json({ exists: rows.length > 0 });
    } catch (err) {
      res.status(200).json({ exists: false });
    }
  }
);

// Check if user exists with user_id return
router.get(
  "/check-user-exists",
  async (req: Request, res: Response): Promise<void> => {
    const { phone } = req.query;

    if (!phone) {
      res
        .status(400)
        .json({ exists: false, message: "Phone parameter required" });
      return;
    }

    try {
      // Parse phone to extract country code and number
      const phoneStr = phone as string;
      let country_code = "";
      let phoneNumber = "";

      if (phoneStr.includes(" ")) {
        [country_code, phoneNumber] = phoneStr.split(" ");
      } else {
        // Default fallback
        country_code = "+91";
        phoneNumber = phoneStr;
      }

      const { rows } = await pool.query(
        "SELECT id FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phoneNumber]
      );

      if (rows.length > 0) {
        res.status(200).json({ exists: true, user_id: rows[0].id });
      } else {
        res.status(200).json({ exists: false });
      }
    } catch (err) {
      res.status(200).json({ exists: false });
    }
  }
);

// JWT-based OTP verification and login
router.post(
  "/login-otp-verify",
  async (req: Request<{}, any, LoginRequest>, res: Response): Promise<void> => {
    const { country_code, phone, otp } = req.body;

    if (!country_code || !phone || !otp) {
      res
        .status(400)
        .json({ message: "country_code, phone, and otp required" });
      return;
    }

    // TESTING MODE: Accept hardcoded OTP only (Twilio verification commented out)
    if (otp !== "123456") {
      res.status(400).json({ message: "Invalid OTP. Use 123456 for testing." });
      return;
    }
    console.log("🔍 TESTING MODE: OTP verified successfully for login:", phone);

    try {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phone]
      );

      if (rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const user: User = rows[0];

      // Generate proper JWT token
      const jwtPayload = {
        id: user.id,
        phone: user.phone,
        plan: user.plan || 1,
        country_code: user.country_code || "",
      };

      const wsToken = jwt.sign(jwtPayload, process.env.JWT_SECRET!, {
        expiresIn: "24h",
      });

      res.json({ user, wsToken });
    } catch (err: any) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Update user profile (except phone/country_code)
router.post(
  "/update-profile",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const auth = req.headers.authorization || "";
      const wsToken = auth.replace("Bearer ", "");

      if (!wsToken) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Decode JWT token properly
      let userId: number;
      try {
        const decoded = jwt.verify(wsToken, process.env.JWT_SECRET!) as any;
        userId = decoded.id;
      } catch {
        res.status(401).json({ message: "Invalid token" });
        return;
      }

      const { firstname, lastname, email, photo_url, representing } = req.body;

      const updateRes = await pool.query(
        `UPDATE users SET firstname = $1, lastname = $2, email = $3, photo_url = $4, representing = $5 
       WHERE id = $6 
       RETURNING id, phone, email, firstname, lastname, country_code, photo_url, plan, representing, created_at`,
        [firstname, lastname, email, photo_url, representing, userId]
      );

      if (updateRes.rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.json(updateRes.rows[0]);
    } catch (err: any) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

export default router;
