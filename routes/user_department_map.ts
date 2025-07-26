import express, { Request, Response } from "express";
import knex from "../db/knex";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

interface BatchUpdateRequest {
  department_id: number;
  add?: number[];
  remove?: number[];
}

// Batch update user_department_map
router.post(
  "/batch-update",
  async (
    req: Request<{}, any, BatchUpdateRequest>,
    res: Response
  ): Promise<void> => {
    const { department_id, add = [], remove = [] } = req.body;

    if (!department_id) {
      res.status(400).json({ message: "department_id is required" });
      return;
    }

    const trx = await knex.transaction();
    try {
      // Add users (prevent duplicates)
      for (const user_id of add) {
        const exists = await trx("user_department_map")
          .where({ department_id, user_id })
          .first();
        if (!exists) {
          await trx("user_department_map").insert({
            department_id,
            user_id,
            status: 1,
          });
        }
      }

      // Remove users (physically delete)
      if (remove.length > 0) {
        await trx("user_department_map")
          .where({ department_id })
          .whereIn("user_id", remove)
          .del();
      }

      await trx.commit();
      res.json({ success: true });
    } catch (err: any) {
      await trx.rollback();
      res
        .status(500)
        .json({ message: "Batch update failed", error: err.message });
    }
  }
);

export default router;
