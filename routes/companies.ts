import express, { Request, Response } from "express";
import knex from "../db/knex";
import { JWTPayload } from "../types";

const router = express.Router();

// GET /api/companies/my-companies - Get all companies for the current user
router.get("/my-companies", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    console.log("Fetching companies for user id:", userId);
    
    const companies = await knex("companies")
      .select("*")
      .where("user_id", userId)
      .orderBy("created_at", "desc");

    console.log("Companies fetched:", companies.length);
    res.json(companies);
  } catch (err: any) {
    console.error("Error fetching companies:", err);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
});

// GET /api/companies/:id - Get specific company details
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Get company statistics using the internal ID for foreign key relationships
    const establishmentsCount = await knex("establishments")
      .where("company_id", company.id)
      .count("* as count")
      .first();

    const totalVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .count("* as count")
      .first();

    const todayVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .whereRaw("DATE(check_in_at) = CURRENT_DATE")
      .count("* as count")
      .first();

    const companyDetails = {
      ...company,
      stats: {
        establishments_count: parseInt(String(establishmentsCount?.count)) || 0,
        total_visitors: parseInt(String(totalVisitors?.count)) || 0,
        today_visitors: parseInt(String(todayVisitors?.count)) || 0,
      }
    };

    res.json(companyDetails);
  } catch (err: any) {
    console.error("Error fetching company details:", err);
    res.status(500).json({ message: "Failed to fetch company details" });
  }
});

// POST /api/companies - Create a new company
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userPlan = req.user?.plan || 1;
    
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { name, description, address1, address2, pincode, gst_number, pan_number, website, phone, email } = req.body;

    if (!name) {
      res.status(400).json({ message: "Company name is required" });
      return;
    }

    // Check if user has reached company limit based on plan
    const [{ count }] = await knex("companies")
      .where("user_id", userId)
      .count("* as count");

    const limit = userPlan === 3 ? 10 : 1; // Enterprise: 10 companies, others: 1
    if (parseInt(String(count)) >= limit) {
      res.status(400).json({
        message: `Plan limit reached. You can only create up to ${limit} companies.`,
      });
      return;
    }

    const [newCompany] = await knex("companies")
      .insert({
        user_id: userId,
        name,
        description,
        address1,
        address2,
        pincode,
        gst_number,
        pan_number,
        website,
        phone,
        email,
        uuid: knex.raw('uuid_generate_v4()'), // Generate UUID for new company
      })
      .returning("*");

    console.log("Company created:", newCompany);
    res.status(201).json(newCompany);
  } catch (err: any) {
    console.error("Error creating company:", err);
    if (err.code === "23505") { // Unique constraint violation
      res.status(400).json({ message: "Company name already exists" });
    } else {
      res.status(500).json({ message: "Failed to create company" });
    }
  }
});

// PUT /api/companies/:id - Update company details
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    const { name, description, address1, address2, pincode, gst_number, pan_number, website, phone, email } = req.body;

    // Verify company ownership
    const existingCompany = await knex("companies")
      .select("id")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!existingCompany) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const [updatedCompany] = await knex("companies")
      .where({ id: existingCompany.id, user_id: userId })
      .update({
        name,
        description,
        address1,
        address2,
        pincode,
        gst_number,
        pan_number,
        website,
        phone,
        email,
        updated_at: knex.fn.now(),
      })
      .returning("*");

    console.log("Company updated:", updatedCompany);
    res.json(updatedCompany);
  } catch (err: any) {
    console.error("Error updating company:", err);
    if (err.code === "23505") { // Unique constraint violation
      res.status(400).json({ message: "Company name already exists" });
    } else {
      res.status(500).json({ message: "Failed to update company" });
    }
  }
});

// DELETE /api/companies/:id - Delete a company
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const existingCompany = await knex("companies")
      .select("id")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!existingCompany) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Delete the company (cascade will handle related records)
    await knex("companies")
      .where({ id: existingCompany.id, user_id: userId })
      .del();

    console.log("Company deleted:", companyUuid);
    res.json({ message: "Company deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting company:", err);
    res.status(500).json({ message: "Failed to delete company" });
  }
});

// GET /api/companies/:id/dashboard - Get company dashboard data
router.get("/:id/dashboard", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id; // Now expects UUID, not integer

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership using UUID
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Get establishments for this company
    const establishments = await knex("establishments")
      .select("*")
      .where("company_id", company.id)
      .orderBy("created_at", "desc");

    // Get visitor statistics
    const totalVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .count("* as count")
      .first();

    const todayVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .whereRaw("DATE(check_in_at) = CURRENT_DATE")
      .count("* as count")
      .first();

    // Get pending requests for this company's establishments
    const pendingRequests = await knex("pending_requests as pr")
      .join("departments as d", function() {
        this.on("pr.target_id", "=", "d.id").andOn("pr.type", "=", knex.raw("'D'"));
      })
      .join("establishments as e", "d.establishment_id", "=", "e.id")
      .join("companies as c", "e.company_id", "=", "c.id")
      .leftJoin("users as u", "pr.user_id", "=", "u.id")
      .select("pr.*", "u.firstname", "u.lastname", "c.name as company_name")
      .where("c.id", company.id)
      .union(
        knex("pending_requests as pr")
          .join("gates as g", function() {
            this.on("pr.target_id", "=", "g.id").andOn("pr.type", "=", knex.raw("'G'"));
          })
          .join("establishments as e", "g.establishment_id", "=", "e.id")
          .join("companies as c", "e.company_id", "=", "c.id")
          .leftJoin("users as u", "pr.user_id", "=", "u.id")
          .select("pr.*", "u.firstname", "u.lastname", "c.name as company_name")
          .where("c.id", company.id)
      );

    const dashboardData = {
      company,
      establishments,
      stats: {
        total_visitors: parseInt(String(totalVisitors?.count)) || 0,
        today_visitors: parseInt(String(todayVisitors?.count)) || 0,
      },
      pendingRequests: pendingRequests || [],
    };

    console.log(`✅ Dashboard data sent for company: ${company.name}`);

    res.json(dashboardData);
  } catch (err: any) {
    console.error("❌ Error fetching company dashboard:", err);
    res.status(500).json({ message: "Failed to fetch company dashboard", error: err.message });
  }
});

// GET /api/companies/:id/establishments - Get all establishments for a company
router.get("/:id/establishments", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Get establishments for this company
    const establishments = await knex("establishments")
      .select("*")
      .where("company_id", company.id)
      .orderBy("created_at", "desc");

    res.json(establishments);
  } catch (err: any) {
    console.error("Error fetching company establishments:", err);
    res.status(500).json({ message: "Failed to fetch establishments" });
  }
});

// POST /api/companies/:id/establishments - Create a new establishment for a company
router.post("/:id/establishments", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userPlan = req.user?.plan || 1;
    const companyUuid = req.params.id;
    const { name, address1, address2, pincode, gst, pan, logo } = req.body;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Check establishment limit based on user plan
    const establishmentLimit = userPlan === 3 ? 10 : 1; // Basic & Pro: 1, Enterprise: 10
    
    const existingEstablishments = await knex("establishments")
      .where("company_id", company.id)
      .count("* as count")
      .first();

    const existingCount = parseInt(String(existingEstablishments?.count)) || 0;

    if (existingCount >= establishmentLimit) {
      res.status(400).json({ 
        message: `Plan limit reached. ${userPlan === 1 ? 'Basic' : userPlan === 3 ? 'Enterprise' : 'Pro'} plan allows maximum ${establishmentLimit} establishment${establishmentLimit > 1 ? 's' : ''}.` 
      });
      return;
    }

    // Determine establishment plan based on user plan
    let establishmentPlan = 1; // Default to Basic
    if (userPlan === 3) establishmentPlan = 2; // Enterprise user gets Pro establishment
    else if (userPlan === 2) establishmentPlan = 2; // Pro user gets Pro establishment

    // Create the establishment
    const [establishment] = await knex("establishments")
      .insert({
        user_id: userId,
        company_id: company.id,
        name,
        address1,
        address2,
        pincode: pincode || '000000', // Default pincode if not provided (NOT NULL constraint)
        gst_number: gst,
        pan_number: pan,
        logo: logo, // Column name is 'logo', not 'logo_url'
        plan: establishmentPlan,
        created_at: new Date(),
        // removed updated_at - column doesn't exist in establishments table
      })
      .returning("*");

    console.log(`✅ Establishment created for company ${company.name}:`, establishment.name);
    res.status(201).json(establishment);
  } catch (err: any) {
    console.error("Error creating establishment:", err);
    res.status(500).json({ message: "Failed to create establishment" });
  }
});

// PUT /api/companies/:id/establishments/:establishmentId - Update an establishment
router.put("/:id/establishments/:establishmentId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;
    const establishmentId = parseInt(req.params.establishmentId);
    const { name, address1, address2, pincode, gst, pan, logo } = req.body;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Verify establishment belongs to this company
    const existingEstablishment = await knex("establishments")
      .select("*")
      .where({ id: establishmentId, company_id: company.id, user_id: userId })
      .first();

    if (!existingEstablishment) {
      res.status(404).json({ message: "Establishment not found" });
      return;
    }

    // Update the establishment
    const [updatedEstablishment] = await knex("establishments")
      .where({ id: establishmentId, company_id: company.id, user_id: userId })
      .update({
        name,
        address1,
        address2,
        pincode,
        gst_number: gst,
        pan_number: pan,
        logo_url: logo,
        updated_at: new Date(),
      })
      .returning("*");

    console.log(`✅ Establishment updated:`, updatedEstablishment.name);
    res.json(updatedEstablishment);
  } catch (err: any) {
    console.error("Error updating establishment:", err);
    res.status(500).json({ message: "Failed to update establishment" });
  }
});

// DELETE /api/companies/:id/establishments/:establishmentId - Delete an establishment
router.delete("/:id/establishments/:establishmentId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;
    const establishmentId = parseInt(req.params.establishmentId);

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Verify establishment belongs to this company
    const existingEstablishment = await knex("establishments")
      .select("*")
      .where({ id: establishmentId, company_id: company.id, user_id: userId })
      .first();

    if (!existingEstablishment) {
      res.status(404).json({ message: "Establishment not found" });
      return;
    }

    // Delete the establishment (cascade will handle related records)
    await knex("establishments")
      .where({ id: establishmentId, company_id: company.id, user_id: userId })
      .del();

    console.log(`✅ Establishment deleted:`, existingEstablishment.name);
    res.json({ message: "Establishment deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting establishment:", err);
    res.status(500).json({ message: "Failed to delete establishment" });
  }
});

// GET /api/companies/:id/analytics - Get analytics data for a company
router.get("/:id/analytics", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Get comprehensive analytics data
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total visitor logs
    const totalVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .count("* as count")
      .first();

    // Today's visitors
    const todayVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .whereRaw("DATE(check_in_at) = CURRENT_DATE")
      .count("* as count")
      .first();

    // This week's visitors
    const weekVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .where("check_in_at", ">=", sevenDaysAgo)
      .count("* as count")
      .first();

    // This month's visitors
    const monthVisitors = await knex("visitor_logs")
      .where("company_id", company.id)
      .where("check_in_at", ">=", thirtyDaysAgo)
      .count("* as count")
      .first();

    // Total establishments
    const totalEstablishments = await knex("establishments")
      .where("company_id", company.id)
      .count("* as count")
      .first();

    // Total gates
    const totalGates = await knex("gates")
      .join("establishments", "gates.establishment_id", "establishments.id")
      .where("establishments.company_id", company.id)
      .count("* as count")
      .first();

    // Total departments
    const totalDepartments = await knex("departments")
      .join("establishments", "departments.establishment_id", "establishments.id")
      .where("establishments.company_id", company.id)
      .count("* as count")
      .first();

    // Pending requests
    const pendingRequests = await knex("pending_requests as pr")
      .join("departments as d", function() {
        this.on("pr.target_id", "=", "d.id").andOn("pr.type", "=", knex.raw("'D'"));
      })
      .join("establishments as e", "d.establishment_id", "=", "e.id")
      .where("e.company_id", company.id)
      .count("* as count")
      .first();

    // Daily visitor trends (last 30 days)
    const dailyTrends = await knex("visitor_logs")
      .select(knex.raw("DATE(check_in_at) as date, COUNT(*) as visitors"))
      .where("company_id", company.id)
      .where("check_in_at", ">=", thirtyDaysAgo)
      .groupByRaw("DATE(check_in_at)")
      .orderByRaw("DATE(check_in_at)");

    // Top establishments by visitors
    const topEstablishments = await knex("visitor_logs as vl")
      .select("e.name", knex.raw("COUNT(*) as visitor_count"))
      .join("establishments as e", "vl.establishment_id", "=", "e.id")
      .where("e.company_id", company.id)
      .groupBy("e.id", "e.name")
      .orderBy("visitor_count", "desc")
      .limit(5);

    // Check-in status distribution
    const checkInStatus = await knex("checkin as c")
      .select("c.status", knex.raw("COUNT(*) as count"))
      .join("establishments as e", "c.establishment_id", "=", "e.id")
      .where("e.company_id", company.id)
      .groupBy("c.status");

    // Average visit duration (if checkout data exists)
    const avgDuration = await knex("checkin")
      .select(knex.raw("AVG(EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60) as avg_minutes"))
      .join("establishments", "checkin.establishment_id", "establishments.id")
      .where("establishments.company_id", company.id)
      .whereNotNull("check_out_at")
      .first();

    const analyticsData = {
      summary: {
        total_visitors: parseInt(String(totalVisitors?.count)) || 0,
        today_visitors: parseInt(String(todayVisitors?.count)) || 0,
        week_visitors: parseInt(String(weekVisitors?.count)) || 0,
        month_visitors: parseInt(String(monthVisitors?.count)) || 0,
        total_establishments: parseInt(String(totalEstablishments?.count)) || 0,
        total_gates: parseInt(String(totalGates?.count)) || 0,
        total_departments: parseInt(String(totalDepartments?.count)) || 0,
        pending_requests: parseInt(String(pendingRequests?.count)) || 0,
        avg_visit_duration: Math.round(parseFloat(String((avgDuration as any)?.avg_minutes)) || 0),
      },
      trends: {
        daily_visitors: dailyTrends,
        top_establishments: topEstablishments,
        checkin_status: checkInStatus,
      },
      company_info: {
        name: company.name,
        created_at: company.created_at,
      }
    };

    console.log(`✅ Analytics data sent for company: ${company.name}`);
    res.json(analyticsData);
  } catch (err: any) {
    console.error("❌ Error fetching company analytics:", err);
    res.status(500).json({ message: "Failed to fetch analytics data", error: err.message });
  }
});

// GET /api/companies/:id/visitors - Get visitor logs for a company
router.get("/:id/visitors", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || "";
    const status = req.query.status as string || "";
    const establishmentId = req.query.establishment as string || "";

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const offset = (page - 1) * limit;

    // Build query with filters
    let query = knex("visitor_logs as vl")
      .select(
        "vl.*",
        "e.name as establishment_name",
        "g.name as gate_name",
        "d.name as department_name"
      )
      .leftJoin("establishments as e", "vl.establishment_id", "e.id")
      .leftJoin("gates as g", "vl.gate_id", "g.id")
      .leftJoin("departments as d", "vl.department_id", "d.id")
      .where("vl.company_id", company.id)
      .orderBy("vl.check_in_at", "desc");

    // Apply filters
    if (search) {
      query = query.andWhere(function() {
        this.whereILike("vl.visitor_name", `%${search}%`)
          .orWhereILike("vl.visitor_phone", `%${search}%`)
          .orWhereILike("vl.visitor_email", `%${search}%`)
          .orWhereILike("e.name", `%${search}%`);
      });
    }

    if (status) {
      query = query.andWhere("vl.status", status);
    }

    if (establishmentId) {
      query = query.andWhere("vl.establishment_id", establishmentId);
    }

    // Get total count for pagination
    const countQuery = query.clone().clearSelect().count("vl.id as count").first();
    const totalResult = await countQuery;
    const total = parseInt(String(totalResult?.count)) || 0;

    // Get paginated results
    const visitors = await query.limit(limit).offset(offset);

    // Get establishments for filter dropdown
    const establishments = await knex("establishments")
      .select("id", "name")
      .where("company_id", company.id)
      .orderBy("name");

    const response = {
      visitors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      establishments,
    };

    console.log(`✅ Visitor logs sent for company: ${company.name} (${visitors.length} records)`);
    res.json(response);
  } catch (err: any) {
    console.error("❌ Error fetching company visitor logs:", err);
    res.status(500).json({ message: "Failed to fetch visitor logs", error: err.message });
  }
});

// GET /api/companies/:id/requests - Get pending requests for a company
router.get("/:id/requests", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string || "pending";
    const type = req.query.type as string || "";

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    const offset = (page - 1) * limit;

    // Build query for requests related to company's establishments
    let query = knex("pending_requests as pr")
      .select(
        "pr.*",
        "u.firstname",
        "u.lastname", 
        "u.phone",
        "u.email",
        "e.name as establishment_name",
        "d.name as department_name",
        "g.name as gate_name"
      )
      .leftJoin("users as u", "pr.user_id", "u.id")
      .leftJoin("departments as d", function() {
        this.on("pr.target_id", "=", "d.id").andOn("pr.type", "=", knex.raw("'D'"));
      })
      .leftJoin("gates as g", function() {
        this.on("pr.target_id", "=", "g.id").andOn("pr.type", "=", knex.raw("'G'"));
      })
      .leftJoin("establishments as e", function() {
        this.on("d.establishment_id", "=", "e.id").orOn("g.establishment_id", "=", "e.id");
      })
      .where("e.company_id", company.id)
      .orderBy("pr.created_at", "desc");

    // Apply filters
    if (status) {
      query = query.andWhere("pr.status", status);
    }

    if (type) {
      query = query.andWhere("pr.type", type);
    }

    // Get total count for pagination
    const countQuery = query.clone().clearSelect().count("pr.id as count").first();
    const totalResult = await countQuery;
    const total = parseInt(String(totalResult?.count)) || 0;

    // Get paginated results
    const requests = await query.limit(limit).offset(offset);

    const response = {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };

    console.log(`✅ Pending requests sent for company: ${company.name} (${requests.length} records)`);
    res.json(response);
  } catch (err: any) {
    console.error("❌ Error fetching company pending requests:", err);
    res.status(500).json({ message: "Failed to fetch pending requests", error: err.message });
  }
});

// PUT /api/companies/:id/requests/:requestId - Approve or deny a pending request
router.put("/:id/requests/:requestId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const companyUuid = req.params.id;
    const requestId = parseInt(req.params.requestId);
    const { action } = req.body; // 'approve' or 'deny'

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!action || !['approve', 'deny'].includes(action)) {
      res.status(400).json({ message: "Invalid action. Must be 'approve' or 'deny'" });
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(companyUuid)) {
      res.status(400).json({ message: "Invalid company ID format" });
      return;
    }

    // Verify company ownership
    const company = await knex("companies")
      .select("*")
      .where({ uuid: companyUuid, user_id: userId })
      .first();

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Get the request and verify it belongs to this company
    const request = await knex("pending_requests as pr")
      .select("pr.*", "e.company_id")
      .leftJoin("departments as d", function() {
        this.on("pr.target_id", "=", "d.id").andOn("pr.type", "=", knex.raw("'D'"));
      })
      .leftJoin("gates as g", function() {
        this.on("pr.target_id", "=", "g.id").andOn("pr.type", "=", knex.raw("'G'"));
      })
      .leftJoin("establishments as e", function() {
        this.on("d.establishment_id", "=", "e.id").orOn("g.establishment_id", "=", "e.id");
      })
      .where("pr.id", requestId)
      .andWhere("e.company_id", company.id)
      .first();

    if (!request) {
      res.status(404).json({ message: "Request not found or not authorized" });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ message: "Request has already been processed" });
      return;
    }

    // Update the request status
    const newStatus = action === 'approve' ? 'approved' : 'denied';
    
    await knex("pending_requests")
      .where("id", requestId)
      .update({
        status: newStatus,
        updated_at: new Date(),
      });

    // If approved, add user to appropriate mapping table
    if (action === 'approve') {
      try {
        if (request.type === 'D') {
          // Add to user_department_map
          await knex("user_department_map")
            .insert({
              user_id: request.user_id,
              department_id: request.target_id,
              created_at: new Date(),
            })
            .onConflict(['user_id', 'department_id'])
            .ignore(); // Ignore if mapping already exists
        } else if (request.type === 'G') {
          // Add to user_gate_map  
          await knex("user_gate_map")
            .insert({
              user_id: request.user_id,
              gate_id: request.target_id,
              created_at: new Date(),
            })
            .onConflict(['user_id', 'gate_id'])
            .ignore(); // Ignore if mapping already exists
        }
      } catch (mappingErr) {
        console.warn("Warning: Failed to create user mapping:", mappingErr);
        // Continue - the request status was updated successfully
      }
    }

    console.log(`✅ Request ${requestId} ${newStatus} for company: ${company.name}`);
    res.json({ message: `Request ${newStatus} successfully`, status: newStatus });
  } catch (err: any) {
    console.error("❌ Error updating request:", err);
    res.status(500).json({ message: "Failed to update request", error: err.message });
  }
});

export default router;