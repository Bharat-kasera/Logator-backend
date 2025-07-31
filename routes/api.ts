import express from "express";
import { Pool } from "pg";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Socket.IO instance will be injected
let io: Server;

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
  "/requests/pending",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      // Fetch pending invitations for this user (both gate and department)
      const pendingInvites = await pool.query(
        `
        SELECT 
          pr.id,
          pr.gate_id,
          pr.department_id,
          pr.status,
          pr.created_at,
          pr.establishment_id,
          e.name as establishment_name,
          g.name as gate_name,
          d.name as department_name,
          e.user_id as owner_id,
          CASE 
            WHEN pr.gate_id IS NOT NULL THEN 'gate'
            WHEN pr.department_id IS NOT NULL THEN 'department'
          END as invitation_type
        FROM pending_request pr
        JOIN establishments e ON pr.establishment_id = e.id
        LEFT JOIN gates g ON pr.gate_id = g.id
        LEFT JOIN departments d ON pr.department_id = d.id
        WHERE pr.recipient_id = $1 AND pr.status = 'pending'
        ORDER BY pr.created_at DESC
      `,
        [userId]
      );

      res.json({ requests: pendingInvites.rows });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch pending requests",
        error: err.message,
      });
    }
  }
);

// Accept or decline invitation
router.post(
  "/requests/:requestId/respond",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { requestId } = req.params;
      const { response } = req.body;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!response || !["accept", "decline"].includes(response)) {
        res.status(400).json({
          message: "response must be 'accept' or 'decline'",
        });
        return;
      }

      // Check if invitation exists and belongs to this user
      const invitationResult = await pool.query(
        "SELECT * FROM pending_request WHERE id = $1 AND recipient_id = $2 AND status = 'pending'",
        [requestId, userId]
      );

      if (invitationResult.rows.length === 0) {
        res.status(404).json({ message: "Invitation not found or already processed" });
        return;
      }

      const invitation = invitationResult.rows[0];

      if (response === "accept") {
        // Check if it's a gate or department invitation and create appropriate mapping
        if (invitation.gate_id) {
          // Gate invitation - create mapping in user_gate_map
          await pool.query(
            "INSERT INTO user_gate_map (gate_id, user_id, status) VALUES ($1, $2, 1) ON CONFLICT (gate_id, user_id) DO UPDATE SET status = 1",
            [invitation.gate_id, userId]
          );
        } else if (invitation.department_id) {
          // Department invitation - create mapping in user_department_map
          await pool.query(
            "INSERT INTO user_department_map (department_id, user_id, status) VALUES ($1, $2, 1) ON CONFLICT (department_id, user_id) DO UPDATE SET status = 1",
            [invitation.department_id, userId]
          );
        }
        
        // Update request status to accepted
        await pool.query(
          "UPDATE pending_request SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [requestId]
        );
      } else {
        // Update request status to declined
      await pool.query(
          "UPDATE pending_request SET status = 'declined', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [requestId]
      );
      }

      res.json({
        message: `Invitation ${response}${response === "accept" ? "ed" : "d"} successfully`,
        response,
        requestId
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

      // Fetch sent invitations for establishments owned by this user (all statuses for admin view)
      const sentInvites = await pool.query(
        `
        SELECT 
          pr.gate_id,
          pr.status,
          pr.created_at,
          pr.establishment_id,
          pr.recipient_id as invited_user_id,
          e.name as establishment_name,
          g.name as gate_name,
          u.firstname as invited_user_firstname,
          u.lastname as invited_user_lastname,
          u.phone as invited_user_phone
        FROM pending_request pr
        LEFT JOIN establishments e ON pr.establishment_id = e.id
        LEFT JOIN gates g ON pr.gate_id = g.id
        LEFT JOIN users u ON pr.recipient_id = u.id
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
      const { gate_id, establishment_id, invited_user_id } =
        req.body;

      if (!userId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!gate_id || !establishment_id || !invited_user_id) {
        res.status(400).json({
          message:
            "gate_id, establishment_id, and invited_user_id are required",
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
        "DELETE FROM pending_request WHERE recipient_id = $1 AND gate_id = $2 AND establishment_id = $3",
        [invited_user_id, gate_id, establishment_id]
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
        SELECT u.id, u.firstname, u.lastname, u.photo_url,
               COALESCE(f.verification_count, 0) as verification_count,
               COALESCE(f.is_verified, false) as is_verified
        FROM users u
        LEFT JOIN face_ids f ON u.id = f.user_id
        WHERE u.phone = $1
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
          photo_url: user.photo_url,
        },
        verificationCount: parseInt(user.verification_count),
        isVerified: user.is_verified,
        needsVerification: !user.is_verified && parseInt(user.verification_count) < 5,
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

      // Fetch pending requests for this user (only pending status)
      const pendingRequestsResult = await pool.query(
        "SELECT pr.*, u.firstname, u.lastname, e.name as establishment_name FROM pending_request pr LEFT JOIN users u ON pr.recipient_id = u.id LEFT JOIN establishments e ON pr.establishment_id = e.id WHERE (pr.recipient_id = $1 OR e.user_id = $1) AND pr.status = 'pending'",
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

// Visitor Management System Endpoints

// Check-in a visitor
router.post(
  "/visitors/checkin",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const receptionistId = req.user?.id;
      const { phone, gateId, visitorName, toMeet, establishmentId, departmentId, photo } = req.body;

      if (!receptionistId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!phone || !gateId || !establishmentId) {
        res.status(400).json({ message: "phone, gateId, and establishmentId are required" });
        return;
      }

      // Parse phone number
      const phoneStr = phone as string;
      let country_code = "";
      let phoneNumber = "";

      if (phoneStr.includes(" ")) {
        [country_code, phoneNumber] = phoneStr.split(" ");
      } else {
        country_code = "+91";
        phoneNumber = phoneStr;
      }

      // Check if user exists, if not create them
      let visitorResult = await pool.query(
        "SELECT id FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phoneNumber]
      );

      let visitorId;
      if (visitorResult.rows.length === 0) {
        // Create new visitor
        const insertResult = await pool.query(
          "INSERT INTO users (phone, country_code, firstname, photo_url) VALUES ($1, $2, $3, $4) RETURNING id",
          [phoneNumber, country_code, visitorName || "Guest", photo || null]
        );
        visitorId = insertResult.rows[0].id;
      } else {
        visitorId = visitorResult.rows[0].id;
      }

      // Create face_id record if photo is provided
      if (photo) {
        await pool.query(
          "INSERT INTO face_ids (user_id, encoding) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [visitorId, photo] // Store photo URL as encoding for now
        );
      }

      // Create check-in record
      const checkinResult = await pool.query(
        `INSERT INTO checkin (establishment_id, department_id, visitor_id, to_meet, 
         checkin_user_id, checkin_gate_id, date_of_entry) 
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE) RETURNING id`,
        [establishmentId, departmentId || null, visitorId, toMeet || null, receptionistId, gateId]
      );

      res.json({
        message: "Visitor checked in successfully",
        checkinId: checkinResult.rows[0].id,
        visitorId
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to check in visitor",
        error: err.message,
      });
    }
  }
);

// Get active checked-in visitors
router.get(
  "/visitors/active/:establishmentId",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { establishmentId } = req.params;
      
      const activeVisitors = await pool.query(
        `
        SELECT 
          c.id as checkin_id,
          c.check_in_at,
          c.to_meet,
          u.id as visitor_id,
          u.firstname,
          u.lastname,
          u.phone,
          u.country_code,
          g.name as gate_name
        FROM checkin c
        JOIN users u ON c.visitor_id = u.id
        JOIN gates g ON c.checkin_gate_id = g.id
        WHERE c.establishment_id = $1 AND c.check_out_at IS NULL
        ORDER BY c.check_in_at DESC
      `,
        [establishmentId]
      );

      res.json({ activeVisitors: activeVisitors.rows });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch active visitors",
        error: err.message,
      });
    }
  }
);

// Check-out a visitor
router.put(
  "/visitors/:checkinId/checkout",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const receptionistId = req.user?.id;
      const { checkinId } = req.params;
      const { gateId } = req.body;

      if (!receptionistId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      const result = await pool.query(
        "UPDATE checkin SET check_out_at = CURRENT_TIMESTAMP, checkout_user_id = $1, checkout_gate_id = $2 WHERE id = $3 AND check_out_at IS NULL RETURNING id",
        [receptionistId, gateId || null, checkinId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Check-in record not found or already checked out" });
        return;
      }

      res.json({ message: "Visitor checked out successfully" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to check out visitor",
        error: err.message,
      });
    }
  }
);

// Reverse checkout (undo checkout)
router.put(
  "/visitors/:checkinId/reverse-checkout",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { checkinId } = req.params;

      const result = await pool.query(
        "UPDATE checkin SET check_out_at = NULL, checkout_user_id = NULL, checkout_gate_id = NULL WHERE id = $1 AND check_out_at IS NOT NULL RETURNING id",
        [checkinId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ message: "Check-in record not found or not checked out" });
        return;
      }

      res.json({ message: "Checkout reversed successfully" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to reverse checkout",
        error: err.message,
      });
    }
  }
);

// Archive visitor record (move from checkin to visitor_logs)
router.post(
  "/visitors/:checkinId/archive",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { checkinId } = req.params;

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Get the complete checkin record
        const checkinResult = await client.query(
          "SELECT * FROM checkin WHERE id = $1",
          [checkinId]
        );

        if (checkinResult.rows.length === 0) {
          await client.query('ROLLBACK');
          res.status(404).json({ message: "Check-in record not found" });
          return;
        }

        const checkin = checkinResult.rows[0];

        // Insert into visitor_logs
        await client.query(
          `INSERT INTO visitor_logs (establishment_id, department_id, visitor_id, to_meet, 
           check_in_at, check_out_at, date_of_entry, checkin_user_id, checkout_user_id, 
           checkin_gate_id, checkout_gate_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            checkin.establishment_id,
            checkin.department_id,
            checkin.visitor_id,
            checkin.to_meet,
            checkin.check_in_at,
            checkin.check_out_at,
            checkin.date_of_entry,
            checkin.checkin_user_id,
            checkin.checkout_user_id,
            checkin.checkin_gate_id,
            checkin.checkout_gate_id
          ]
        );

        // Delete from checkin table
        await client.query("DELETE FROM checkin WHERE id = $1", [checkinId]);

        await client.query('COMMIT');
        res.json({ message: "Visitor record archived successfully" });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to archive visitor record",
        error: err.message,
      });
    }
  }
);

// Record face verification
router.post(
  "/visitors/verify-face",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const receptionistId = req.user?.id;
      const { visitorId, similarity } = req.body;

      if (!receptionistId || !visitorId) {
        res.status(400).json({ message: "visitorId is required" });
        return;
      }

      // Get current verification status
      const currentVerification = await pool.query(
        "SELECT verification_count, verified_by_1, verified_by_2, verified_by_3, verified_by_4, verified_by_5 FROM face_ids WHERE user_id = $1",
        [visitorId]
      );

      let count = 0;
      let updateFields = [];
      let updateValues = [visitorId];

      if (currentVerification.rows.length > 0) {
        count = currentVerification.rows[0].verification_count;
        const row = currentVerification.rows[0];
        
        // Check if this receptionist has already verified this user
        if ([row.verified_by_1, row.verified_by_2, row.verified_by_3, row.verified_by_4, row.verified_by_5].includes(receptionistId)) {
          res.json({ message: "Face already verified by this receptionist" });
          return;
        }
      }

      if (count < 5) {
        count++;
        const columnName = `verified_by_${count}`;
        updateFields.push(`${columnName} = $${updateValues.length + 1}`);
        updateValues.push(receptionistId);
        
        updateFields.push(`verification_count = $${updateValues.length + 1}`);
        updateValues.push(count);
        
        if (count >= 5) {
          updateFields.push(`is_verified = $${updateValues.length + 1}`);
          updateValues.push(true);
        }
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        await pool.query(
          `INSERT INTO face_ids (user_id, verification_count, ${`verified_by_${count}`}, is_verified, updated_at) 
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET ${updateFields.join(', ')}`,
          currentVerification.rows.length === 0 
            ? [visitorId, count, receptionistId, count >= 5]
            : updateValues
        );
      }

      res.json({ message: "Face verification recorded successfully" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to record face verification",
        error: err.message,
      });
    }
  }
);

// Get recently checked-out visitors (for checked-out tab)
router.get(
  "/visitors/checked-out/:establishmentId",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { establishmentId } = req.params;
      
      const checkedOutVisitors = await pool.query(
        `
        SELECT 
          c.id as checkin_id,
          c.check_in_at,
          c.check_out_at,
          c.to_meet,
          u.id as visitor_id,
          u.firstname,
          u.lastname,
          u.phone,
          u.country_code,
          g1.name as checkin_gate_name,
          g2.name as checkout_gate_name
        FROM checkin c
        JOIN users u ON c.visitor_id = u.id
        LEFT JOIN gates g1 ON c.checkin_gate_id = g1.id
        LEFT JOIN gates g2 ON c.checkout_gate_id = g2.id
        WHERE c.establishment_id = $1 AND c.check_out_at IS NOT NULL
        ORDER BY c.check_out_at DESC
        LIMIT 50
      `,
        [establishmentId]
      );

      res.json({ checkedOutVisitors: checkedOutVisitors.rows });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to fetch checked-out visitors",
        error: err.message,
      });
    }
  }
);

// Send invitation to user by phone number for department access
router.post(
  "/requests/invite-department",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const senderId = req.user?.id;
      const { userPhone, departmentId } = req.body;

      if (!senderId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!userPhone || !departmentId) {
        res.status(400).json({
          message: "userPhone and departmentId are required",
        });
        return;
      }

      // Parse phone to extract country code and number
      const phoneStr = userPhone as string;
      let country_code = "";
      let phoneNumber = "";

      if (phoneStr.includes(" ")) {
        [country_code, phoneNumber] = phoneStr.split(" ");
      } else {
        country_code = "+91";
        phoneNumber = phoneStr;
      }

      // Find the user by country code and phone number
      const userResult = await pool.query(
        "SELECT id, phone, country_code FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phoneNumber]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ message: "User not found with this phone number" });
        return;
      }

      const recipientId = userResult.rows[0].id;

      // Get department information and verify sender owns the establishment
      const departmentResult = await pool.query(
        `SELECT d.id, d.establishment_id, d.name as department_name, e.user_id as owner_id, e.name as establishment_name,
                sender.firstname as sender_firstname, sender.lastname as sender_lastname
         FROM departments d 
         JOIN establishments e ON d.establishment_id = e.id 
         LEFT JOIN users sender ON e.user_id = sender.id
         WHERE d.id = $1`,
        [departmentId]
      );

      if (departmentResult.rows.length === 0) {
        res.status(404).json({ message: "Department not found" });
        return;
      }

      const department = departmentResult.rows[0];
      if (department.owner_id !== senderId) {
        res.status(403).json({
          message: "You don't have permission to invite users to this department",
        });
        return;
      }

      // Add sender name to department object for notification
      department.sender_name = `${department.sender_firstname} ${department.sender_lastname}`.trim();

      // Check if invitation already exists for this department
      const existingInvitation = await pool.query(
        "SELECT id FROM pending_request WHERE recipient_id = $1 AND department_id = $2 AND status = 'pending'",
        [recipientId, departmentId]
      );

      if (existingInvitation.rows.length > 0) {
        res.status(400).json({ message: "Invitation already exists for this user" });
        return;
      }

      // Create pending request for department
      const insertResult = await pool.query(
        "INSERT INTO pending_request (department_id, recipient_id, sender_id, establishment_id, status) VALUES ($1, $2, $3, $4, 'pending')",
        [departmentId, recipientId, senderId, department.establishment_id]
      );

      // Send real-time notification via WebSocket
      if (io) {
        const notificationData = {
          type: 'department_invitation_received',
          message: `You have a new department invitation from ${department.establishment_name}`,
          departmentId: departmentId,
          departmentName: department.department_name,
          establishmentName: department.establishment_name,
          senderName: department.sender_name,
        };

        // Send to specific user room
        io.to(`user_${recipientId}`).emit('notification', notificationData);
        console.log(`Sent real-time department notification to user ${recipientId}`);
      }

      res.json({ 
        message: "Department invitation sent successfully",
        departmentId: departmentId,
        departmentName: department.department_name
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        message: "Failed to send department invitation",
        error: err.message,
      });
    }
  }
);

// Send invitation to user by phone number for gate access
router.post(
  "/requests/invite",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const senderId = req.user?.id;
      const { userPhone, gateId } = req.body;

      if (!senderId) {
        res.status(401).json({ message: "Unauthorized: user id missing" });
        return;
      }

      if (!userPhone || !gateId) {
        res.status(400).json({
          message: "userPhone and gateId are required",
        });
        return;
      }

      // Parse phone to extract country code and number (same logic as check-user-exists)
      const phoneStr = userPhone as string;
      let country_code = "";
      let phoneNumber = "";

      if (phoneStr.includes(" ")) {
        [country_code, phoneNumber] = phoneStr.split(" ");
      } else {
        // Default fallback
        country_code = "+91";
        phoneNumber = phoneStr;
      }

      // Find the user by country code and phone number
      const userResult = await pool.query(
        "SELECT id, phone, country_code FROM users WHERE country_code = $1 AND phone = $2",
        [country_code, phoneNumber]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ message: "User not found with this phone number" });
        return;
      }

      const recipientId = userResult.rows[0].id;

      // Get gate information and verify sender owns the establishment
      const gateResult = await pool.query(
        `SELECT g.id, g.establishment_id, g.name as gate_name, e.user_id as owner_id, e.name as establishment_name,
                sender.firstname as sender_firstname, sender.lastname as sender_lastname
         FROM gates g 
         JOIN establishments e ON g.establishment_id = e.id 
         LEFT JOIN users sender ON e.user_id = sender.id
         WHERE g.id = $1`,
        [gateId]
      );

      if (gateResult.rows.length === 0) {
        res.status(404).json({ message: "Gate not found" });
        return;
      }

      const gate = gateResult.rows[0];
      if (gate.owner_id !== senderId) {
        res.status(403).json({
          message: "You don't have permission to invite users to this gate",
        });
        return;
      }

      // Add sender name to gate object for notification
      gate.sender_name = `${gate.sender_firstname} ${gate.sender_lastname}`.trim();

      // Check if invitation already exists (using new table structure)
      const existingInvitation = await pool.query(
        "SELECT id FROM pending_request WHERE recipient_id = $1 AND gate_id = $2 AND status = 'pending'",
        [recipientId, gateId]
      );

      if (existingInvitation.rows.length > 0) {
        res.status(400).json({ message: "Invitation already exists for this user" });
        return;
      }

      // Create pending request (using new table structure)
      const insertResult = await pool.query(
        "INSERT INTO pending_request (gate_id, recipient_id, sender_id, establishment_id, status) VALUES ($1, $2, $3, $4, 'pending')",
        [gateId, recipientId, senderId, gate.establishment_id]
      );

      // Send real-time notification via WebSocket
      if (io) {
        const notificationData = {
          type: 'invitation_received',
          message: `You have a new invitation from ${gate.establishment_name}`,
          gateId: gateId,
          gateName: gate.gate_name,
          establishmentName: gate.establishment_name,
          senderName: gate.sender_name,
        };

        // Send to specific user room
        io.to(`user_${recipientId}`).emit('notification', notificationData);
        console.log(`Sent real-time notification to user ${recipientId}`);
      }

      res.json({ 
        message: "Invitation sent successfully",
        gateId: gateId,
        gateName: gate.gate_name
      });
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

// Function to set Socket.IO instance
export const setSocketIO = (socketIO: Server) => {
  io = socketIO;
};

// Add more routes as you build them:
// router.use('/login', require('./login'));
// router.use('/profile', require('./profile'));

export default router;
