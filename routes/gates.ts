import express, { Request, Response } from "express";
import { Gate } from "../types";
import { Pool } from "pg";
import knex from "../db/knex";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

interface CreateGateRequest {
  establishment_id: number;
  name: string;
  geofencing?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
}

interface UpdateGateRequest {
  name?: string;
  geofencing?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number | null;
}

// Get all gates for an establishment
router.get(
  "/:establishment_id",
  async (
    req: Request<{ establishment_id: string }>,
    res: Response
  ): Promise<void> => {
    const { establishment_id } = req.params;

    try {
      const result = await knex("gates").where({ establishment_id });
      res.json(result as Gate[]);
    } catch (err: unknown) {
      res
        .status(500)
        .json({ 
          message: "Error fetching gates", 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
  }
);

// Add a gate
router.post(
  "/",
  async (
    req: Request<{}, {}, CreateGateRequest>,
    res: Response
  ): Promise<void> => {
    const {
      establishment_id,
      name,
      geofencing = false,
      latitude = null,
      longitude = null,
      radius = null,
    } = req.body;

    if (!establishment_id || !name) {
      res
        .status(400)
        .json({ message: "establishment_id and name are required" });
      return;
    }

    try {
      // Check establishment plan and enforce limits
      const establishmentResult = await pool.query(
        "SELECT plan FROM establishments WHERE id = $1",
        [establishment_id]
      );

      if (establishmentResult.rows.length === 0) {
        res.status(404).json({ message: "Establishment not found" });
        return;
      }

      const establishmentPlan = establishmentResult.rows[0].plan;

      // Check current gate count
      const countResult = await pool.query(
        "SELECT COUNT(*) as count FROM gates WHERE establishment_id = $1",
        [establishment_id]
      );

      const currentCount = parseInt(countResult.rows[0].count);

      // Plan-based restrictions
      let gateLimit = 10; // Pro and Enterprise establishments default to 10
      if (establishmentPlan === 1) {
        gateLimit = 1; // Basic plan allows only 1 gate
      }

      if (currentCount >= gateLimit) {
        const planName = establishmentPlan === 1 ? 'Basic' : establishmentPlan === 2 ? 'Pro' : 'Enterprise';
        res.status(400).json({
          message: `Plan limit reached. ${planName} plan allows only ${gateLimit} gate(s).`,
        });
        return;
      }

      const [row] = await knex("gates")
        .insert({
          establishment_id,
          name,
          geofencing,
          latitude,
          longitude,
          radius,
        })
        .returning(["id"]);

      const id = row.id;
      res.json({
        id,
        establishment_id,
        name,
        geofencing,
        latitude,
        longitude,
        radius,
      });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ 
          message: "Error adding gate", 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
  }
);

// Update a gate by id
router.put(
  "/:id",
  async (
    req: Request<{ id: string }, {}, UpdateGateRequest>,
    res: Response
  ): Promise<void> => {
    const { id } = req.params;
    const { name, geofencing, latitude, longitude, radius } = req.body;

    try {
      await knex("gates")
        .where({ id })
        .update({ name, geofencing, latitude, longitude, radius });
      res.json({ success: true });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ 
          message: "Error updating gate", 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
  }
);

// Delete a gate by id
router.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      await knex("gates").where({ id }).del();
      res.json({ success: true });
    } catch (err: unknown) {
      res
        .status(500)
        .json({ 
          message: "Error deleting gate", 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
  }
);

export default router;
