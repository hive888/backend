// models/selfStudyRegistrationModel.js
const db = require('../config/database');
const logger = require('../utils/logger');

const SelfStudyRegistration = {
  async findByCustomer(conn, customer_id) {
    const sql = `
      SELECT id, status, registered_at, access_code_id, certificate_url
      FROM selfstudy_registrations
      WHERE customer_id = ?
      LIMIT 1
    `;
    const [rows] = await conn.query(sql, [customer_id]);
    return rows[0] || null;
  },

  async findById(conn, id) {
    const sql = `
      SELECT id, status, registered_at, access_code_id, certificate_url, customer_id
      FROM selfstudy_registrations
      WHERE id = ?
      LIMIT 1
    `;
    const [rows] = await conn.query(sql, [id]);
    return rows[0] || null;
  },

  async create(conn, { customer_id, access_code_id = null }) {
    const sql = `
      INSERT INTO selfstudy_registrations (customer_id, access_code_id)
      VALUES (?, ?)
    `;
    const [result] = await conn.query(sql, [customer_id, access_code_id]);
    return result.insertId;
  },

  async updateCertificateUrl(conn, customer_id, certificate_url) {
    const sql = `
      UPDATE selfstudy_registrations 
      SET certificate_url = ?
      WHERE customer_id = ?
    `;
    const [result] = await conn.query(sql, [certificate_url, customer_id]);
    
    if (result.affectedRows === 0) {
      logger.warn('No selfstudy_registration record found for customer when updating certificate URL', {
        customer_id,
        certificate_url
      });
      return false;
    }
    
    logger.info('Certificate URL updated successfully', {
      customer_id,
      certificate_url
    });
    return true;
  }
};

module.exports = SelfStudyRegistration;