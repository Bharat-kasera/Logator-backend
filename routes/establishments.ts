import express, { Request, Response } from "express";
import { Pool } from "pg";
import { Establishment } from "../types";
import knex from "../db/knex";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// GET my establishments
router.get(
  "/my-establishments",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      console.log("Fetching establishments for user id:", userId);
      const establishments = await knex("establishments")
        .select("id", "name", "logo")
        .where("user_id", userId);
      console.log("Establishments fetched:", establishments);
      res.json(establishments);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch establishments" });
    }
  }
);

// POST create establishment
router.post(
  "/create-establishment",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const userPlan = req.user?.plan;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      const [{ count }] = await knex("establishments")
        .where("user_id", userId)
        .count("* as count");

      const limit = userPlan === 3 ? 10 : 1;
      if (parseInt(String(count)) >= limit) {
        res.status(400).json({
          message: `Plan limit reached. You can only add up to ${limit} establishments.`,
        });
        return;
      }

      // Business logic for subscription plans:
      // Enterprise plan (3) users automatically create establishments with Pro plan (2)
      // Other users create establishments with their same plan
      let establishmentPlan = userPlan;
      if (userPlan === 3) {
        establishmentPlan = 2; // Enterprise users get Pro establishment plan
      }

      const [newEst] = await knex("establishments")
        .insert({
          user_id: userId,
          name: req.body.name,
          address1: req.body.address1,
          address2: req.body.address2,
          pincode: req.body.pincode,
          gst_number: req.body.gst,
          pan_number: req.body.pan,
          logo: req.body.logo,
          plan: establishmentPlan,
        })
        .returning(["id", "name", "logo"]);

      res.json(newEst);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message, error: err });
    }
  }
);

// UPDATE establishment by ID
router.put(
  "/:id",
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const estId = req.params.id;
      const updateFields: Partial<Establishment> = {
        name: req.body.name,
        address1: req.body.address1,
        address2: req.body.address2,
        pincode: req.body.pincode,
        gst_number: req.body.gst_number,
        pan_number: req.body.pan_number,
        logo: req.body.logo,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        plan: req.body.plan,
      };

      // Remove undefined fields
      Object.keys(updateFields).forEach(
        (k) =>
          updateFields[k as keyof Establishment] === undefined &&
          delete updateFields[k as keyof Establishment]
      );

      const updated = await knex("establishments")
        .where("id", estId)
        .update(updateFields)
        .returning("*");

      if (!updated || updated.length === 0) {
        res.status(404).json({ message: "Establishment not found" });
        return;
      }

      res.json(updated[0]);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to update establishment",
        error: err.message,
      });
    }
  }
);

// GET establishment(s) by user ID (for debugging)
router.get(
  "/by-user/:userId",
  async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId;

      if (!userId) {
        res.status(400).json({ message: "User ID is required" });
        return;
      }

      const establishments = await knex("establishments").where(
        "user_id",
        userId
      );

      if (!establishments || establishments.length === 0) {
        res
          .status(404)
          .json({ message: "No establishment found for this user" });
        return;
      }

      res.json(establishments);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch establishment(s)" });
    }
  }
);

export default router;
