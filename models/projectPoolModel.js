const db = require('../config/database');

class ProjectPool {
  // Create a new project listing
  static async createProject(data) {
    const sql = `
      INSERT INTO project_pool (
        creator_id, title, tagline, category, project_type, industry, country, project_stage,
        description, deliverables, timeline, team_structure, budget, funding_goal,
        funding_raised, mentor_needed, required_skills, project_logo_url, cover_image_url, status,
        pitch_video_url, deck_url, target_audience, competitive_advantage,
        blockchains, github_link, twitter_link, discord_link, extra_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.creator_id,
      data.title,
      data.tagline || null,
      data.category,
      data.project_type || null,
      data.industry || null,
      data.country || null,
      data.project_stage || null,
      data.description,
      JSON.stringify(data.deliverables || []),
      data.timeline,
      data.team_structure,
      data.budget,
      data.funding_goal || null,
      data.funding_raised || '0',
      data.mentor_needed ? 1 : 0,
      JSON.stringify(data.required_skills || []),
      data.project_logo_url || null,
      data.cover_image_url || null,
      data.status || 0, // Default to 0 (Pending)
      data.pitch_video_url || null,
      data.deck_url || null,
      data.target_audience || null,
      data.competitive_advantage || null,
      data.blockchains || null,
      data.github_link || null,
      data.twitter_link || null,
      data.discord_link || null,
      data.extra_details ? JSON.stringify(data.extra_details) : null
    ];

    const [result] = await db.query(sql, values);
    return result.insertId;
  }

  // Get projects with filters
  static async findAllProjects(filters = {}) {
    let sql = `
      SELECT p.*, u.username as creator_username, c.email as creator_email
      FROM project_pool p
      JOIN users u ON p.creator_id = u.user_id
      LEFT JOIN customers c ON u.customer_id = c.customer_id
    `;
    const values = [];
    const conditions = [];

    if (filters.status !== undefined && filters.status !== '') {
      conditions.push('p.status = ?');
      values.push(filters.status);
    }
    if (filters.category && filters.category !== 'All') {
      conditions.push('p.category = ?');
      values.push(filters.category);
    }
    if (filters.creator_id) {
      conditions.push('p.creator_id = ?');
      values.push(filters.creator_id);
    }
    if (filters.project_type && filters.project_type !== 'All') {
      conditions.push('p.project_type = ?');
      values.push(filters.project_type);
    }
    if (filters.project_stage && filters.project_stage !== 'All') {
      conditions.push('p.project_stage = ?');
      values.push(filters.project_stage);
    }
    if (filters.country && filters.country !== 'All') {
      conditions.push('p.country = ?');
      values.push(filters.country);
    }
    if (filters.industry && filters.industry !== 'All') {
      conditions.push('p.industry = ?');
      values.push(filters.industry);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.created_at DESC';

    const [rows] = await db.query(sql, values);
    return rows.map(row => ({
      ...row,
      deliverables: typeof row.deliverables === 'string' ? JSON.parse(row.deliverables) : row.deliverables,
      required_skills: typeof row.required_skills === 'string' ? JSON.parse(row.required_skills) : row.required_skills,
      extra_details: typeof row.extra_details === 'string' ? JSON.parse(row.extra_details) : row.extra_details
    }));
  }

  // Find a specific project by ID
  static async findProjectById(id) {
    const sql = `
      SELECT p.*, u.username as creator_username, c.email as creator_email
      FROM project_pool p
      JOIN users u ON p.creator_id = u.user_id
      LEFT JOIN customers c ON u.customer_id = c.customer_id
      WHERE p.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      ...row,
      deliverables: typeof row.deliverables === 'string' ? JSON.parse(row.deliverables) : row.deliverables,
      required_skills: typeof row.required_skills === 'string' ? JSON.parse(row.required_skills) : row.required_skills,
      extra_details: typeof row.extra_details === 'string' ? JSON.parse(row.extra_details) : row.extra_details
    };
  }

  // Update moderation status of a project
  static async updateProjectStatus(id, status) {
    const sql = 'UPDATE project_pool SET status = ? WHERE id = ?';
    const [result] = await db.query(sql, [status, id]);
    return result.affectedRows > 0;
  }

  // Delete a project
  static async deleteProject(id) {
    const sql = 'DELETE FROM project_pool WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Create an application to join a project
  static async createApplication(data) {
    const sql = `
      INSERT INTO project_applications (
        project_id, user_id, role_type, motivation, contribution_details, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.project_id,
      data.user_id,
      data.role_type,
      data.motivation,
      data.contribution_details || null,
      data.status || 0 // Default to 0 (Pending)
    ];

    const [result] = await db.query(sql, values);
    return result.insertId;
  }

  // Get all applications for a specific project
  static async findApplicationsByProject(projectId) {
    const sql = `
      SELECT a.*, u.username, c.email
      FROM project_applications a
      JOIN users u ON a.user_id = u.user_id
      LEFT JOIN customers c ON u.customer_id = c.customer_id
      WHERE a.project_id = ?
      ORDER BY a.created_at DESC
    `;
    const [rows] = await db.query(sql, [projectId]);
    return rows;
  }

  // Update application status (Accept / Reject)
  static async updateApplicationStatus(appId, status) {
    const sql = 'UPDATE project_applications SET status = ? WHERE id = ?';
    const [result] = await db.query(sql, [status, appId]);
    return result.affectedRows > 0;
  }

  // Find all applications submitted by a specific user
  static async findUserApplications(userId) {
    const sql = `
      SELECT a.*, p.title as project_title, p.category as project_category, p.budget as project_budget, p.description as project_description
      FROM project_applications a
      JOIN project_pool p ON a.project_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `;
    const [rows] = await db.query(sql, [userId]);
    return rows;
  }

  // Get all unique categories currently in approved project listings
  static async findUniqueCategories() {
    const sql = "SELECT DISTINCT category FROM project_pool WHERE status = 1 ORDER BY category ASC";
    const [rows] = await db.query(sql);
    return rows.map(r => r.category);
  }
}

module.exports = ProjectPool;
