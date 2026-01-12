const db = require('../config/database');

class TalentPoolRegistration {
  static async create(registrationData) {
    const sql = `
      INSERT INTO talent_pool_registration (
        full_name, email, country, city, phone_number, age_range, gender,
        education_level, years_experience, skills, spoken_languages,
        preferred_work_type, availability, heard_about_us, heard_about_other,
        skills_description, cv_file_path, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      registrationData.full_name,
      registrationData.email,
      registrationData.country,
      registrationData.city,
      registrationData.phone_number,
      registrationData.age_range,
      registrationData.gender,
      registrationData.education_level,
      registrationData.years_experience,
      JSON.stringify(registrationData.skills),
      JSON.stringify(registrationData.spoken_languages),
      registrationData.preferred_work_type,
      registrationData.availability,
      registrationData.heard_about_us,
      registrationData.heard_about_other,
      registrationData.skills_description,
      registrationData.cv_file_path,
      registrationData.status || 0 // Default to 0 if not provided
    ];

    const [result] = await db.query(sql, values);
    return result.insertId;
  }

  static async findAll(status = null) {
    let sql = `
      SELECT 
        id, status, full_name, email, country, city, phone_number, age_range, gender,
        education_level, years_experience, skills, spoken_languages,
        preferred_work_type, availability, heard_about_us, heard_about_other,
        skills_description, cv_file_path, created_at
      FROM talent_pool_registration
    `;
    
    const values = [];
    
    if (status !== null) {
      sql += ' WHERE status = ?';
      values.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await db.query(sql, values);
    return rows;
  }

  static async findById(id) {
    const sql = `
      SELECT 
        id, status, full_name, email, country, city, phone_number, age_range, gender,
        education_level, years_experience, skills, spoken_languages,
        preferred_work_type, availability, heard_about_us, heard_about_other,
        skills_description, cv_file_path, created_at
      FROM talent_pool_registration
      WHERE id = ?
    `;
    
    const [rows] = await db.query(sql, [id]);
    return rows[0];
  }

  static async findByEmail(email) {
    const sql = `
      SELECT id, status, email, full_name
      FROM talent_pool_registration
      WHERE email = ?
    `;
    
    const [rows] = await db.query(sql, [email]);
    return rows[0];
  }

  static async updateStatus(id, status) {
    const sql = `
      UPDATE talent_pool_registration 
      SET status = ? 
      WHERE id = ?
    `;
    
    const [result] = await db.query(sql, [status, id]);
    return result.affectedRows > 0;
  }

  static async update(id, updateData) {
    const allowedFields = [
      'status', 'full_name', 'country', 'city', 'phone_number', 'age_range', 
      'gender', 'education_level', 'years_experience', 'skills', 'spoken_languages',
      'preferred_work_type', 'availability', 'heard_about_us', 'heard_about_other',
      'skills_description'
    ];
    
    const updates = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        if (key === 'skills' || key === 'spoken_languages') {
          values.push(JSON.stringify(updateData[key]));
        } else {
          values.push(updateData[key]);
        }
      }
    });
    
    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    values.push(id);
    
    const sql = `
      UPDATE talent_pool_registration 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `;
    
    const [result] = await db.query(sql, values);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const sql = `DELETE FROM talent_pool_registration WHERE id = ?`;
    const [result] = await db.query(sql, [id]);
    return result.affectedRows > 0;
  }

  static async getStats() {
    const statsQueries = {
      byAgeRange: `
        SELECT age_range, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY age_range
      `,
      byEducation: `
        SELECT education_level, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY education_level
      `,
      byExperience: `
        SELECT years_experience, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY years_experience
      `,
      byWorkType: `
        SELECT preferred_work_type, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY preferred_work_type
      `,
      byAvailability: `
        SELECT availability, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY availability
      `,
      byCountry: `
        SELECT country, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY country 
        ORDER BY count DESC
      `,
      byStatus: `
        SELECT status, COUNT(*) as count 
        FROM talent_pool_registration 
        GROUP BY status
      `
    };

    const stats = {};
    
    for (const [key, query] of Object.entries(statsQueries)) {
      const [rows] = await db.query(query);
      stats[key] = rows;
    }

    return stats;
  }

  static async getByFilters(filters) {
    let sql = `
      SELECT 
        id, status, full_name, email, country, city, phone_number, age_range, gender,
        education_level, years_experience, skills, spoken_languages,
        preferred_work_type, availability, heard_about_us, heard_about_other,
        skills_description, cv_file_path, created_at
      FROM talent_pool_registration
      WHERE 1=1
    `;
    
    const values = [];
    
    if (filters.status !== undefined) {
      sql += ' AND status = ?';
      values.push(filters.status);
    }
    
    if (filters.country) {
      sql += ' AND country = ?';
      values.push(filters.country);
    }
    
    if (filters.education_level) {
      sql += ' AND education_level = ?';
      values.push(filters.education_level);
    }
    
    if (filters.years_experience) {
      sql += ' AND years_experience = ?';
      values.push(filters.years_experience);
    }
    
    if (filters.preferred_work_type) {
      sql += ' AND preferred_work_type = ?';
      values.push(filters.preferred_work_type);
    }
    
    if (filters.availability) {
      sql += ' AND availability = ?';
      values.push(filters.availability);
    }

    if (filters.search) {
      sql += ' AND (full_name LIKE ? OR email LIKE ? OR skills_description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await db.query(sql, values);
    return rows;
  }
}

module.exports = TalentPoolRegistration;