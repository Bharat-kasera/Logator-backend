import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Import individual route modules
import registerRoutes from "./register";
import establishmentsRoutes from "./establishments";
import otpRoutes from "./otp";
import departmentsRoutes from "./departments";
import gatesRoutes from "./gates";
import userDepartmentMapRoutes from "./user_department_map";

// User Notifications Endpoints

// Get pending invitations for logged-in user
router.get(
  "/notifications/user",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      // Fetch pending invitations for this user
      const pendingInvites = await pool.query(
        `
        SELECT 
          pr.gate_dept_id,
          pr.type,
          pr.created_at,
          pr.establishment_id,
          e.name as establishment_name,
          CASE 
            WHEN pr.type = 'D' THEN d.name
            WHEN pr.type = 'G' THEN g.name
          END as target_name,
          u.firstname as invited_by_firstname,
          u.lastname as invited_by_lastname
        FROM pending_request pr
        LEFT JOIN establishments e ON pr.establishment_id = e.id
        LEFT JOIN departments d ON pr.type = 'D' AND pr.gate_dept_id = d.id
        LEFT JOIN gates g ON pr.type = 'G' AND pr.gate_dept_id = g.id
        LEFT JOIN users u ON e.user_id = u.id
        WHERE pr.user_id = $1
        ORDER BY pr.created_at DESC
      `,
        [userId]
      );

      res.json({ invitations: pendingInvites.rows });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch user notifications",
        error: err.message,
      });
    }
  }
);

// Accept or decline invitation
router.post(
  "/notifications/user/respond",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { gate_dept_id, type, establishment_id, action } = req.body;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!gate_dept_id || !type || !establishment_id || !action) {
        res.status(400).json({
          message:
            "gate_dept_id, type, establishment_id, and action are required",
        });
        return;
      }

      if (!["accept", "decline"].includes(action)) {
        res
          .status(400)
          .json({ message: "action must be 'accept' or 'decline'" });
        return;
      }

      // Check if invitation exists
      const invitationCheck = await pool.query(
        "SELECT * FROM pending_request WHERE user_id = $1 AND gate_dept_id = $2 AND type = $3 AND establishment_id = $4",
        [userId, gate_dept_id, type, establishment_id]
      );

      if (invitationCheck.rows.length === 0) {
        res.status(404).json({ message: "Invitation not found" });
        return;
      }

      if (action === "accept") {
        // Create mapping based on type
        if (type === "D") {
          // Add to user_department_map
          await pool.query(
            "INSERT INTO user_department_map (department_id, user_id, status) VALUES ($1, $2, 1) ON CONFLICT (department_id, user_id) DO UPDATE SET status = 1",
            [gate_dept_id, userId]
          );
        } else if (type === "G") {
          // Add to user_gate_map
          await pool.query(
            "INSERT INTO user_gate_map (gate_id, user_id, status) VALUES ($1, $2, 1) ON CONFLICT (gate_id, user_id) DO UPDATE SET status = 1",
            [gate_dept_id, userId]
          );
        }
      }

      // Remove from pending_request
      await pool.query(
        "DELETE FROM pending_request WHERE user_id = $1 AND gate_dept_id = $2 AND type = $3 AND establishment_id = $4",
        [userId, gate_dept_id, type, establishment_id]
      );

      res.json({
        message: `Invitation ${action}ed successfully`,
        action,
        type: type === "D" ? "department" : "gate",
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to respond to invitation",
        error: err.message,
      });
    }
  }
);

// Establishment Admin Notifications Endpoints

// Get sent invitations for establishment admin
router.get(
  "/notifications/admin",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      // Fetch sent invitations for establishments owned by this user
      const sentInvites = await pool.query(
        `
        SELECT 
          pr.gate_dept_id,
          pr.type,
          pr.created_at,
          pr.establishment_id,
          pr.user_id as invited_user_id,
          e.name as establishment_name,
          CASE 
            WHEN pr.type = 'D' THEN d.name
            WHEN pr.type = 'G' THEN g.name
          END as target_name,
          u.firstname as invited_user_firstname,
          u.lastname as invited_user_lastname,
          u.phone as invited_user_phone
        FROM pending_request pr
        LEFT JOIN establishments e ON pr.establishment_id = e.id
        LEFT JOIN departments d ON pr.type = 'D' AND pr.gate_dept_id = d.id
        LEFT JOIN gates g ON pr.type = 'G' AND pr.gate_dept_id = g.id
        LEFT JOIN users u ON pr.user_id = u.id
        WHERE e.user_id = $1
        ORDER BY pr.created_at DESC
      `,
        [userId]
      );

      res.json({ sentInvitations: sentInvites.rows });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch admin notifications",
        error: err.message,
      });
    }
  }
);

// Delete/cancel sent invitation
router.delete(
  "/notifications/admin/cancel",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { gate_dept_id, type, establishment_id, invited_user_id } =
        req.body;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!gate_dept_id || !type || !establishment_id || !invited_user_id) {
        res.status(400).json({
          message:
            "gate_dept_id, type, establishment_id, and invited_user_id are required",
        });
        return;
      }

      // Check if user owns the establishment
      const establishmentCheck = await pool.query(
        "SELECT id FROM establishments WHERE id = $1 AND user_id = $2",
        [establishment_id, userId]
      );

      if (establishmentCheck.rows.length === 0) {
        res.status(403).json({
          message:
            "You don't have permission to cancel invitations for this establishment",
        });
        return;
      }

      // Delete the pending invitation
      const deleteResult = await pool.query(
        "DELETE FROM pending_request WHERE user_id = $1 AND gate_dept_id = $2 AND type = $3 AND establishment_id = $4",
        [invited_user_id, gate_dept_id, type, establishment_id]
      );

      if (deleteResult.rowCount === 0) {
        res.status(404).json({ message: "Invitation not found" });
        return;
      }

      res.json({ message: "Invitation cancelled successfully" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to cancel invitation",
        error: err.message,
      });
    }
  }
);

// Check-in System Endpoints

// Get authorized gates for user (for gate selection in check-in)
router.get(
  "/checkin/gates",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      // Get gates user has access to through user_gate_map
      const authorizedGates = await pool.query(
        `
        SELECT 
          g.id,
          g.name,
          g.latitude,
          g.longitude,
          g.geofencing,
          g.radius,
          e.id as establishment_id,
          e.name as establishment_name
        FROM gates g
        JOIN establishments e ON g.establishment_id = e.id
        JOIN user_gate_map ugm ON g.id = ugm.gate_id
        WHERE ugm.user_id = $1 AND ugm.status = 1
        ORDER BY e.name, g.name
      `,
        [userId]
      );

      res.json({ authorizedGates: authorizedGates.rows });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch authorized gates",
        error: err.message,
      });
    }
  }
);

// Check for duplicate active check-ins
router.post(
  "/checkin/check-duplicate",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { phone, establishment_id } = req.body;

      if (!phone || !establishment_id) {
        res
          .status(400)
          .json({ message: "phone and establishment_id are required" });
        return;
      }

      // Check for active check-ins (where check_out_at is null)
      const activeCheckIn = await pool.query(
        `
        SELECT c.id, c.check_in_at, u.firstname, u.lastname
        FROM checkin c
        JOIN users u ON c.visitor_id = u.id
        WHERE u.phone = $1 AND c.establishment_id = $2 AND c.check_out_at IS NULL
      `,
        [phone, establishment_id]
      );

      res.json({
        hasActiveCheckIn: activeCheckIn.rows.length > 0,
        activeCheckIn: activeCheckIn.rows[0] || null,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to check for duplicate check-ins",
        error: err.message,
      });
    }
  }
);

// Get face verification count for user
router.get(
  "/checkin/face-verification/:phone",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { phone } = req.params;

      // Get user and their face verification count
      const userCheck = await pool.query(
        `
        SELECT u.id, u.firstname, u.lastname, COUNT(f.id) as verification_count
        FROM users u
        LEFT JOIN face_ids f ON u.id = f.user_id
        WHERE u.phone = $1
        GROUP BY u.id, u.firstname, u.lastname
      `,
        [phone]
      );

      if (userCheck.rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const user = userCheck.rows[0];
      res.json({
        user: {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          phone: phone,
        },
        verificationCount: parseInt(user.verification_count),
        needsVerification: parseInt(user.verification_count) < 5,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to check face verification status",
        error: err.message,
      });
    }
  }
);

// Dashboard endpoint to fetch notifications and plan status
router.get(
  "/dashboard",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      // Fetch pending requests for this user
      const pendingRequestsResult = await pool.query(
        "SELECT pr.*, u.firstname, u.lastname, e.name as establishment_name FROM pending_request pr LEFT JOIN users u ON pr.user_id = u.id LEFT JOIN establishments e ON pr.establishment_id = e.id WHERE pr.user_id = $1 OR e.user_id = $1",
        [userId]
      );

      // Fetch user's establishments and their plans
      const establishmentsResult = await pool.query(
        "SELECT id, name, plan FROM establishments WHERE user_id = $1",
        [userId]
      );

      // Get recent visitor activity
      const recentActivityResult = await pool.query(
        "SELECT COUNT(*) as total_visitors, COUNT(CASE WHEN DATE(check_in_at) = CURRENT_DATE THEN 1 END) as today_visitors FROM visitor_logs vl JOIN establishments e ON vl.establishment_id = e.id WHERE e.user_id = $1",
        [userId]
      );

      res.json({
        pendingRequests: pendingRequestsResult.rows,
        establishments: establishmentsResult.rows,
        stats: recentActivityResult.rows[0] || {
          total_visitors: 0,
          today_visitors: 0,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch dashboard data",
        error: err.message,
      });
    }
  }
);

// User invitation endpoint for mappings
router.post(
  "/invite-user",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const requesterId = req.user?.id;
      const { user_id, type, target_id, establishment_id } = req.body;

      if (!requesterId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!user_id || !type || !target_id || !establishment_id) {
        res.status(400).json({
          message:
            "user_id, type, target_id, and establishment_id are required",
        });
        return;
      }

      if (type !== "D" && type !== "G") {
        res
          .status(400)
          .json({ message: "type must be 'D' for department or 'G' for gate" });
        return;
      }

      // Check if requester owns the establishment
      const establishmentCheck = await pool.query(
        "SELECT id FROM establishments WHERE id = $1 AND user_id = $2",
        [establishment_id, requesterId]
      );

      if (establishmentCheck.rows.length === 0) {
        res.status(403).json({
          message:
            "You don't have permission to invite users to this establishment",
        });
        return;
      }

      // Check if invitation already exists
      const existingInvitation = await pool.query(
        "SELECT gate_dept_id FROM pending_request WHERE user_id = $1 AND type = $2 AND gate_dept_id = $3 AND establishment_id = $4",
        [user_id, type, target_id, establishment_id]
      );

      if (existingInvitation.rows.length > 0) {
        res
          .status(400)
          .json({ message: "Invitation already exists for this user" });
        return;
      }

      // Create pending request
      await pool.query(
        "INSERT INTO pending_request (user_id, type, gate_dept_id, establishment_id) VALUES ($1, $2, $3, $4)",
        [user_id, type, target_id, establishment_id]
      );

      res.json({ message: "Invitation sent successfully" });
    } catch (err: any) {
      console.error(err);
      res
        .status(500)
        .json({ message: "Failed to send invitation", error: err.message });
    }
  }
);

// Mount registration routes directly at root
router.use("/", registerRoutes);
router.use("/establishments", establishmentsRoutes);
router.use("/otp", otpRoutes);
router.use("/departments", departmentsRoutes);
router.use("/gates", gatesRoutes);
router.use("/user-department-map", userDepartmentMapRoutes);

// Add more routes as you build them:
// router.use('/login', require('./login'));
// router.use('/profile', require('./profile'));

export default router;
