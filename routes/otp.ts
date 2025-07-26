import express, { Request, Response } from "express";
import twilio from "twilio";
import { OTPRequest } from "../types";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Send OTP via Twilio
router.post(
  "/send-otp",
  async (req: Request<{}, any, OTPRequest>, res: Response): Promise<void> => {
    const { phone, country_code } = req.body;

    if (!phone || !country_code) {
      res.status(400).json({ message: "Phone and country_code are required" });
      return;
    }

    const fullPhone = `${country_code}${phone}`;

    try {
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications.create({
          to: fullPhone,
          channel: "sms",
        });

      console.log("OTP sent successfully:", verification.status);
      res.json({
        success: true,
        status: verification.status,
        message: "OTP sent successfully",
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send OTP",
        error: error.message,
      });
    }
  }
);

// Verify OTP via Twilio
router.post(
  "/verify-otp",
  async (req: Request<{}, any, OTPRequest>, res: Response): Promise<void> => {
    const { phone, country_code, otp } = req.body;

    if (!phone || !country_code || !otp) {
      res
        .status(400)
        .json({ message: "Phone, country_code, and OTP are required" });
      return;
    }

    const fullPhone = `${country_code}${phone}`;

    try {
      const verificationCheck = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks.create({
          to: fullPhone,
          code: otp,
        });

      const isValid = verificationCheck.status === "approved";

      console.log("OTP verification result:", verificationCheck.status);
      res.json({
        success: isValid,
        status: verificationCheck.status,
        message: isValid ? "OTP verified successfully" : "Invalid OTP",
      });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify OTP",
        error: error.message,
      });
    }
  }
);

export default router;
