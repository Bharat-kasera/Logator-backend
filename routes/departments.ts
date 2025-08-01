import express, { Request, Response } from "express";
import { Pool } from "pg";
import { Department } from "../types";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Get all departments for an establishment
router.get(
  "/:establishment_id",
  async (
    req: Request<{ establishment_id: string }>,
    res: Response
  ): Promise<void> => {
    const { establishment_id } = req.params;

    try {
      const result = await pool.query(
        "SELECT * FROM departments WHERE establishment_id = $1",
        [establishment_id]
      );
      res.json(result.rows as Department[]);
    } catch (err: any) {
      res
        .status(500)
        .json({ message: "Error fetching departments", error: err.message });
    }
  }
);

// Add a department
router.post(
  "/",
  async (
    req: Request<{}, any, { establishment_id: number; name: string }>,
    res: Response
  ): Promise<void> => {
    const { establishment_id, name } = req.body;

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

      // Check current department count
      const countResult = await pool.query(
        "SELECT COUNT(*) as count FROM departments WHERE establishment_id = $1",
        [establishment_id]
      );

      const currentCount = parseInt(countResult.rows[0].count);

      // Plan-based restrictions
      let departmentLimit = 10; // Pro and Enterprise establishments default to 10
      if (establishmentPlan === 1) {
        departmentLimit = 1; // Basic plan allows only 1 department
      }

      if (currentCount >= departmentLimit) {
        const planName = establishmentPlan === 1 ? 'Basic' : establishmentPlan === 2 ? 'Pro' : 'Enterprise';
        res.status(400).json({
          message: `Plan limit reached. ${planName} plan allows only ${departmentLimit} department(s).`,
        });
        return;
      }

      const result = await pool.query(
        "INSERT INTO departments (establishment_id, name) VALUES ($1, $2) RETURNING *",
        [establishment_id, name]
      );

      const department: Department = result.rows[0];
      res.json(department);
    } catch (err: any) {
      res
        .status(500)
        .json({ message: "Error adding department", error: err.message });
    }
  }
);

// Delete a department by id
router.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      await pool.query("DELETE FROM departments WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({ message: "Error deleting department", error: err.message });
    }
  }
);

export default router;
