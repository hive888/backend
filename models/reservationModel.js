// models/reservationModel.js
const db = require('../config/database');
const logger = require('../utils/logger');

class Reservation {
  async create({ product_id, first_name, last_name, email, company_name, number_of_people, notes, scheduled_date }) {
    try {
      const [result] = await db.query(
        `INSERT INTO reservations 
        (product_id, first_name, last_name, email, company_name, number_of_people, notes, scheduled_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [product_id, first_name, last_name, email, company_name, number_of_people, notes, scheduled_date]
      );
      return result.insertId;
    } catch (err) {
      logger.error('Reservation creation failed in model:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }
async getAllRegistrations({ limit = 20, offset = 0, search = '', hasScreenshot = '', status = '', customerId = '' }) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
  
      if (search) {
        whereClause += ` AND (c.first_name LIKE ? OR c.email LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }
  
      if (status) {
        whereClause += ` AND o.payment_status = ?`;
        params.push(status);
      }
  
      if (customerId) {
        whereClause += ` AND cr.customer_id = ?`;
        params.push(customerId);
      }
  
      // We'll use HAVING clause for screenshot filtering later
      let havingClause = '';
      if (hasScreenshot === 'yes') {
        havingClause = 'HAVING screenshot_count > 0';
      } else if (hasScreenshot === 'no') {
        havingClause = 'HAVING screenshot_count = 0';
      }
  
      const query = `
        SELECT 
          cr.id,
          cr.customer_id,
          cr.currency,
          cr.amount,
          cr.payment_method,
          cr.network_name,
          cr.payment_currency,
          cr.created_at,
          cr.order_id,
          c.first_name,
          c.last_name,
          c.email,
          o.payment_status AS status,
          (SELECT COUNT(*) FROM payment_screenshots WHERE registration_id = cr.id) AS screenshot_count
        FROM customer_registrations cr
        JOIN customers c ON cr.customer_id = c.customer_id
        LEFT JOIN orders o ON cr.order_id = o.order_id
        ${whereClause}
        ${havingClause}
        ORDER BY cr.created_at DESC
        LIMIT ? OFFSET ?
      `;
  
      params.push(limit, offset);
  
      const [registrations] = await db.query(query, params);
  
      // Count query without LIMIT/OFFSET
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM (
          SELECT cr.id,
            (SELECT COUNT(*) FROM payment_screenshots WHERE registration_id = cr.id) AS screenshot_count
          FROM customer_registrations cr
          JOIN customers c ON cr.customer_id = c.customer_id
          LEFT JOIN orders o ON cr.order_id = o.order_id
          ${whereClause}
          ${havingClause}
        ) AS sub
      `;
  
      const [countResult] = await db.query(countQuery, params.slice(0, params.length - 2)); // Exclude limit/offset
      const total = countResult[0]?.total || 0;
  
      return { registrations, total };
    } catch (err) {
      console.error('Database error:', err);
      return { registrations: [], total: 0 };
    }
  }
  
  
  async getWalletAddress({ paymentMethod }) {
    try {
      logger.info('Starting wallet address lookup', {
        paymentMethod,
        currency,
        timestamp: new Date().toISOString()
      });
  
      // First, get the network ID for this payment method + network name combination
      console.log('Querying payment_method_networks table', {
        query: `SELECT id FROM payment_method_networks WHERE payment_method_id = ?`,
        parameters: [paymentMethod]
      });
  
      const [networkRows] = await db.query(
        `SELECT id FROM payment_method_networks 
         WHERE payment_method_id = ?`,
        [paymentMethod]
      );
  
      logger.debug('Network query results', {
        results: networkRows,
        rowCount: networkRows ? networkRows.length : 0
      });
  
      if (!networkRows || networkRows.length === 0) {
        logger.warn('No matching network found', {
          paymentMethod,
          suggestion: 'Check if network name is correctly spelled in both request and database'
        });
        return null;
      }
  
      const networkId = networkRows[0].id;
      logger.debug('Found network ID', { networkId });
  
      // Then get the wallet address for this payment method + network + currency
      logger.debug('Querying payment_method_currencies table', {
        query: `SELECT walletAddress FROM payment_method_currencies WHERE payment_method_id = ? AND network_id = ? AND currency_code = ?`,
        parameters: [paymentMethod, networkId, currency]
      });
  
      const [currencyRows] = await db.query(
        `SELECT walletAddress FROM payment_method_currencies
         WHERE payment_method_id = ? AND network_id = ? AND currency_code = ?`,
        [paymentMethod, networkId, currency]
      );
  
      logger.debug('Currency query results', {
        results: currencyRows,
        rowCount: currencyRows ? currencyRows.length : 0
      });
  
      if (!currencyRows || currencyRows.length === 0) {
        logger.warn('No currency configuration found', {
          paymentMethod,
          networkId,
          currency,
          suggestion: 'Check if this currency is supported for the selected payment method and network'
        });
        return null;
      }
  
      if (!currencyRows[0].walletAddress) {
        logger.warn('Wallet address is empty for valid configuration', {
          paymentMethod,
          networkId,
          currency,
          suggestion: 'Check database records - walletAddress might be set to empty string or NULL'
        });
        return null;
      }
  
      const walletAddress = currencyRows[0].walletAddress;
      logger.info('Successfully retrieved wallet address', {
        paymentMethod,

        currency,
        walletAddress,
        timestamp: new Date().toISOString()
      });
  
      return walletAddress;
  
    } catch (err) {
      logger.error('Error getting wallet address:', {
        error: err.message,
        stack: err.stack,
        paymentMethod,
        currency,
        timestamp: new Date().toISOString(),
        systemErrorCode: err.code, // If available
        sqlState: err.sqlState // If available
      });
      throw err;
    }
  }
  async getRegistrationDetail(id) {
    try {
      const [rows] = await db.query(
        `SELECT 
          cr.id,
          cr.customer_id,
          cr.currency,
          cr.amount,
          cr.payment_method,
          cr.network_name,
          cr.payment_currency,
          cr.order_id,
          cr.created_at,
          cr.updated_at,
          c.first_name,
          c.last_name,
          c.email,
          c.phone
         FROM customer_registrations cr
         JOIN customers c ON cr.customer_id = c.customer_id
         WHERE cr.id = ?`,
        [id]
      );
      
      return rows[0] || null;
      
    } catch (err) {
      console.error('Error fetching registration detail:', err);
      return null;
    }
  }
  
 async getRegistrationScreenshots(id) {
    try {
      const [rows] = await db.query(
        `SELECT 
          id,
          file_url,
          created_at
         FROM payment_screenshots
         WHERE registration_id = ?
         ORDER BY created_at DESC`,
        [id]
      );
      
      return rows;
      
    } catch (err) {
      console.error('Error fetching screenshots:', err);
      return [];
    }
  }
  
   async getRegistrationCustomer(id) {
    try {
      // First get the customer_id from the registration
      const [registration] = await db.query(
        `SELECT customer_id FROM customer_registrations WHERE id = ?`,
        [id]
      );
      
      if (!registration[0]) return null;
      
      const customerId = registration[0].customer_id;
      
      // Then get full customer details
      const [rows] = await db.query(
        `SELECT 
          customer_id,
          email,
          phone,
          is_active,
          first_name,
          last_name,
          profile_picture,
          date_of_birth,
          gender,
          is_email_verified,
          is_phone_verified,
          email_verified_at,
          phone_verified_at,
          two_factor_enabled,
          referral_code,
          created_at,
          updated_at,
          is_kyc_verified,
          customer_type,
          isShippingTheSame,
          referral_index,
          referred_by,
          source
         FROM customers
         WHERE customer_id = ?`,
        [customerId]
      );
      
      return rows[0] || null;
      
    } catch (err) {
      console.error('Error fetching customer:', err);
      return null;
    }
  }
  async findAll({ page = 1, limit = 10, filters = {} }) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = '';
      const params = [];
      
      // Build WHERE clause based on filters
      if (Object.keys(filters).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(filters)) {
          conditions.push(`${key} = ?`);
          params.push(value);
        }
        
      }
      
      // Get paginated results
      const [reservations] = await db.query(
        `SELECT r.*, 
         p.name as product_name
         FROM reservations r
         JOIN products p ON r.product_id = p.product_id
         ORDER BY r.reserved_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );
      
      // Get total count
      const [totalCount] = await db.query(
        `SELECT COUNT(*) as total FROM reservations r ${whereClause}`,
        params
      );
      
      return {
        reservations,
        total: totalCount[0].total
      };
    } catch (err) {
      logger.error('Failed to get all reservations in model:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }
  async getReservationsSummary({ filters = {} } = {}) {
    try {
      let whereClause = '';
      const params = [];
      
      // Build WHERE clause based on filters
      if (Object.keys(filters).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(filters)) {
          conditions.push(`${key} = ?`);
          params.push(value);
        }
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }
  
      const [summary] = await db.query(
        `SELECT 
          r.product_id,
          p.name as product_name,
          DATE(r.scheduled_date) as reservation_date,
          SUM(r.number_of_people) as total_people,
          COUNT(*) as reservation_count
         FROM reservations r
         JOIN products p ON r.product_id = p.product_id
         ${whereClause}
         GROUP BY r.product_id, DATE(r.scheduled_date)
         ORDER BY reservation_date, r.product_id`,
        params
      );
  
      return summary;
    } catch (err) {
      logger.error('Failed to get reservations summary in model:', {
        error: err.message,
        stack: err.stack
      });
      throw err;
    }
  }
  async findById(reservation_id) {
    try {
      const [rows] = await db.query(
        `SELECT r.*, 
         p.name as product_name
         FROM reservations r
         JOIN products p ON r.product_id = p.product_id
         WHERE r.reservation_id = ?`,
        [reservation_id]
      );
      return rows[0];
    } catch (err) {
      logger.error(`Reservation model findById error for ID ${reservation_id}:`, {
        error: err.message,
        stack: err.stack,
        reservationId: reservation_id
      });
      throw err;
    }
  }
  async findReservById(reservation_id, customer_id) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM customer_registrations 
         WHERE id = ? AND customer_id = ?`,
        [reservation_id, customer_id]
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return rows[0];
    } catch (err) {
      logger.error(`Failed to find registration:`, {
        error: err.message,
        stack: err.stack,
        reservationId: reservation_id,
        customerId: customer_id
      });
      throw err;
    }
  }
// Add this method to your Reservation class
async register({ 
  customer_id,
  currency, 
  token, 
  amount, 
  paymentMethod,
  networkName,
  paymentCurrency,
  order_id
}) {
  try {
    const [result] = await db.query(
      `INSERT INTO customer_registrations 
      (customer_id, currency, token, amount, payment_method, network_name, payment_currency,order_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?,?)`,
      [customer_id, currency, token, amount, paymentMethod, networkName, paymentCurrency,order_id]
    );
    return result.insertId;
  } catch (err) {
    logger.error('Customer registration failed in model:', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}
  async update(reservation_id, updateData) {
    try {
      const fieldsToUpdate = Object.keys(updateData);
      if (fieldsToUpdate.length === 0) {
        return; // No fields to update
      }
      
      const setClause = fieldsToUpdate.map(field => `${field} = ?`).join(', ');
      const values = fieldsToUpdate.map(field => updateData[field]);
      values.push(reservation_id);
      
      await db.query(
        `UPDATE reservations SET ${setClause} WHERE reservation_id = ?`,
        values
      );
    } catch (err) {
      logger.error(`Reservation model update error for ID ${reservation_id}:`, {
        error: err.message,
        stack: err.stack,
        reservationId: reservation_id,
        updateData
      });
      throw err;
    }
  }

  async delete(reservation_id) {
    try {
      await db.query(
        'DELETE FROM reservations WHERE reservation_id = ?',
        [reservation_id]
      );
    } catch (err) {
      logger.error(`Reservation model delete error for ID ${reservation_id}:`, {
        error: err.message,
        stack: err.stack,
        reservationId: reservation_id
      });
      throw err;
    }
  }


  async updatePaymentStatusByOrderId(orderId, status) {
  const query = `
    UPDATE reservations 
    SET payment_status = ?, updated_at = NOW()
    WHERE order_id = ?
  `;
  
  await db.query(query, [status, orderId]);
}
}

module.exports = new Reservation();