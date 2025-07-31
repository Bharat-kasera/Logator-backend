import express, { Request, Response } from "express";
// COMMENTED OUT FOR TESTING - USING HARDCODED OTP INSTEAD
// import twilio from "twilio";
import { OTPRequest } from "../types";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// COMMENTED OUT TWILIO CLIENT INITIALIZATION FOR TESTING
// Initialize Twilio client only if credentials are available
// let client: ReturnType<typeof twilio> | null = null;
// if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
//   client = twilio(
//     process.env.TWILIO_ACCOUNT_SID,
//     process.env.TWILIO_AUTH_TOKEN
//   );
// }

// Send OTP via Twilio (with development fallback)
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
      // TESTING MODE: Always use hardcoded OTP (Twilio commented out)
      console.log("🚀 TESTING MODE: Mock OTP sent to", fullPhone);
      console.log("📱 Use OTP: 123456 for login");
      
      res.json({
        success: true,
        status: "pending",
        message: "OTP sent successfully (Testing Mode - Use 123456)",
        testingMode: true,
        mockOtp: "123456"
      });

      /* COMMENTED OUT TWILIO CODE FOR TESTING
      // Check if Twilio is configured
      if (client && process.env.TWILIO_VERIFY_SERVICE_SID) {
        // Production: Use real Twilio
        const verification = await client.verify.v2
          .services(process.env.TWILIO_VERIFY_SERVICE_SID)
          .verifications.create({
            to: fullPhone,
            channel: "sms",
          });

        console.log("OTP sent successfully via Twilio:", verification.status);
        res.json({
          success: true,
          status: verification.status,
          message: "OTP sent successfully",
        });
      } else {
        // Development: Use mock OTP
        console.log("🚀 DEVELOPMENT MODE: Mock OTP sent to", fullPhone);
        console.log("📱 Use OTP: 123456 for login");
        
        res.json({
          success: true,
          status: "pending",
          message: "OTP sent successfully (Development Mode - Use 123456)",
          developmentMode: true,
          mockOtp: "123456"
        });
      }
      */
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

// Verify OTP via Twilio (with development fallback)
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
      // TESTING MODE: Always use hardcoded OTP verification
      const isValid = otp === "123456";
      const status = isValid ? "approved" : "denied";
      console.log("🔍 TESTING MODE: OTP verification for", fullPhone, "- OTP:", otp, "- Valid:", isValid);

      res.json({
        success: isValid,
        status: status,
        message: isValid ? "OTP verified successfully" : "Invalid OTP (Use 123456)",
        testingMode: true
      });

      /* COMMENTED OUT TWILIO CODE FOR TESTING
      let isValid = false;
      let status = "denied";

      // Check if Twilio is configured
      if (client && process.env.TWILIO_VERIFY_SERVICE_SID) {
        // Production: Use real Twilio verification
        const verificationCheck = await client.verify.v2
          .services(process.env.TWILIO_VERIFY_SERVICE_SID)
          .verificationChecks.create({
            to: fullPhone,
            code: otp,
          });

        isValid = verificationCheck.status === "approved";
        status = verificationCheck.status;
        console.log("OTP verification result via Twilio:", status);
      } else {
        // Development: Use mock OTP verification
        isValid = otp === "123456";
        status = isValid ? "approved" : "denied";
        console.log("🔍 DEVELOPMENT MODE: OTP verification for", fullPhone, "- OTP:", otp, "- Valid:", isValid);
      }

      res.json({
        success: isValid,
        status: status,
        message: isValid ? "OTP verified successfully" : "Invalid OTP",
      });
      */
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
