import express, { Request, Response } from "express";
import knex from "../db/knex";
import CryptoJS from "crypto-js";

const router = express.Router();

// Secret key for hashing - should match frontend
const HASH_SECRET = 'logator_qr_secret_2024';

/**
 * Generate hash for a user ID (same logic as frontend)
 */
const generateQRHash = (userId: number | string): string => {
  const data = `logator:${userId}`;
  const hash = CryptoJS.HmacSHA256(data, HASH_SECRET).toString(CryptoJS.enc.Hex);
  return hash.substring(0, 12).toUpperCase();
};

// POST /api/qr/resolve - Resolve QR hash to user information
router.post("/resolve", async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrHash } = req.body;
    
    if (!qrHash || typeof qrHash !== 'string') {
      res.status(400).json({ message: "QR hash is required" });
      return;
    }

    // Clean the hash (remove LOGATOR- prefix if present)
    const cleanHash = qrHash.replace('LOGATOR-', '');
    
    if (!/^[A-F0-9]{12}$/.test(cleanHash)) {
      res.status(400).json({ message: "Invalid QR hash format" });
      return;
    }

    // Get all users and check which one matches the hash
    const users = await knex("users").select("id", "phone", "firstname", "lastname", "country_code");
    
    let matchingUser = null;
    for (const user of users) {
      const userHash = generateQRHash(user.id);
      if (userHash === cleanHash) {
        matchingUser = user;
        break;
      }
    }

    if (!matchingUser) {
      res.status(404).json({ message: "User not found for this QR code" });
      return;
    }

    // Return user information (phone number is what the check-in system expects)
    res.json({
      success: true,
      user: {
        id: matchingUser.id,
        phone: matchingUser.phone,
        country_code: matchingUser.country_code,
        firstname: matchingUser.firstname,
        lastname: matchingUser.lastname,
      },
      // Return phone with country code for check-in system compatibility
      phoneNumber: `${matchingUser.country_code || '+91'} ${matchingUser.phone}`
    });

  } catch (err: any) {
    console.error("Error resolving QR hash:", err);
    res.status(500).json({ message: "Failed to resolve QR code" });
  }
});

// GET /api/qr/generate/:userId - Generate QR hash for a user (for testing)
router.get("/generate/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId);
    const currentUserId = req.user?.id;
    
    // Only allow users to generate QR for themselves (or admins could be added later)
    if (currentUserId !== userId) {
      res.status(403).json({ message: "Unauthorized to generate QR for this user" });
      return;
    }

    const qrHash = generateQRHash(userId);
    const qrCode = `LOGATOR-${qrHash}`;
    
    res.json({
      success: true,
      userId,
      qrHash,
      qrCode,
    });

  } catch (err: any) {
    console.error("Error generating QR hash:", err);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
});

export default router;