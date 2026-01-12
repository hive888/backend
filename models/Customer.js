const db = require('../config/database');
const logger = require('../utils/logger');

const Customer = {
    async create(data) {
        try {
          const [result] = await db.query('INSERT INTO customers SET ?', [data]);
          return await this.findById(result.insertId);
        } catch (err) {
          // Log detailed error for debugging
          logger.error('Customer creation failed', {
            error: err.message,
            code: err.code,
            email: data.email,
            sqlMessage: err.sqlMessage
          });
          throw err;
        }
      },
      async findByEmail(email) {
        try {
            const [rows] = await db.query(
                `SELECT * FROM customers WHERE email = ?`,
                [email]
            );
            return rows[0];
        } catch (err) {
            logger.error('Failed to find customer by email', {
              email: email,
              error: err.message
            });
            throw err;
        }
    },
    async findByTelegramId(telegramId) {
    try {
        const [rows] = await db.query(
            `SELECT 
                customer_id,
                first_name,
                last_name,
                email,
                phone,
                is_email_verified,
                is_phone_verified,
                is_kyc_verified,
                profile_picture
             FROM customers 
             WHERE telegram_id = ?`,
            [telegramId]
        );
        return rows[0] || null;
    } catch (err) {
        logger.error('Failed to find customer by Telegram ID', {
            telegramId: telegramId,
            error: err.message
        });
        throw err;
    }
},

     async updateVerificationStatus(customer_id, is_email_verified, email_verified_at) {
        try {
            await db.query(
                `UPDATE customers 
                 SET is_email_verified = ?, email_verified_at = ?
                 WHERE customer_id = ?`,
                [
                    is_email_verified ? 1 : 0, // Convert boolean to 1/0
                    email_verified_at,
                    customer_id
                ]
            );
        } catch (err) {
            logger.error(`Update verification status error:`, err);
            throw err;
        }
    },
    async findAll() {
        try {
            const [rows] = await db.query(
                'SELECT * FROM customers WHERE deleted_at IS NULL'
            );
            return rows;
        } catch (err) {
            logger.error('Customer model findAll error:', {
                error: err.message,
                stack: err.stack
            });
            throw err;
        }
    },

    async findAllPaginated({ limit, offset, search = '' }) {
        try {
            let query = 'SELECT * FROM customers WHERE deleted_at IS NULL';
            const params = [];
            
            if (search) {
                query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
            
            const [rows] = await db.query(query, params);
            return rows;
        } catch (err) {
            logger.error('Customer model findAllPaginated error:', {
                error: err.message,
                stack: err.stack,
                params: { limit, offset, search }
            });
            throw err;
        }
    },

    async countAll(search = '') {
        try {
            let query = 'SELECT COUNT(*) AS total FROM customers WHERE deleted_at IS NULL';
            const params = [];
            
            if (search) {
                query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }
            
            const [[{ total }]] = await db.query(query, params);
            return total;
        } catch (err) {
            logger.error('Customer model countAll error:', {
                error: err.message,
                stack: err.stack,
                search
            });
            throw err;
        }
    },
    async getSummary(search = '') {
        try {
          let baseQuery = `
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
              SUM(CASE WHEN customer_type = 'individual' THEN 1 ELSE 0 END) AS individual,
              SUM(CASE WHEN customer_type = 'business' THEN 1 ELSE 0 END) AS business
            FROM customers
            WHERE deleted_at IS NULL
          `;
          const params = [];
      
          if (search) {
            baseQuery += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
          }
      
          const [[summary]] = await db.query(baseQuery, params);
          return summary;
        } catch (err) {
          logger.error('Customer model getSummary error:', {
            error: err.message,
            stack: err.stack,
            search
          });
          throw err;
        }
      },
      
async findById(customer_id) {
    try {
        const [rows] = await db.query(
            `SELECT * FROM customers 
            WHERE customer_id = ? AND deleted_at IS NULL
            LIMIT 1`,
            [customer_id]
        );
        
        if (!rows[0]) return null;
        
        return rows[0];
    } catch (err) {
        logger.error('Failed to find customer by ID', {
            customerId: customer_id,
            error: err.message
        });
        throw err;
    }
},
async findShippingAddress(customer_id) {
    try {
        const [rows] = await db.query(
            `SELECT 
                recipient_name,
                address_line1,
                address_line2,
                city,
                state,
                postal_code,
                country,
                phone
            FROM addresses 
            WHERE customer_id = ? 
            AND address_type = 'billing'
            LIMIT 1`,
            [customer_id]
        );
        
        if (!rows[0]) return null;
        
        return rows[0];
    } catch (err) {
        logger.error(`Customer model findShippingAddress error for ID ${customer_id}:`, {
            error: err.message,
            stack: err.stack,
            customerId: customer_id
        });
        throw err;
    }
},
    async findByIdWithAddresses(customer_id) {
        try {
            // First query - get customer info and addresses
            const [customerRows] = await db.query(`
                SELECT 
                    c.customer_id,c.is_phone_verified, c.email, c.phone, c.first_name, c.last_name,
                    c.profile_picture, c.date_of_birth, c.gender, c.referral_code,
                    a.address_id, a.address_type, a.recipient_name, c.is_email_verified,
                    c.referral_code, a.address_line1, a.address_line2, a.city, 
                    a.state, a.postal_code, a.country, a.is_default, a.notes, 
                    a.isShippingTheSame
                FROM 
                    customers c
                LEFT JOIN 
                    addresses a ON c.customer_id = a.customer_id
                WHERE 
                    c.customer_id = ? 
                    AND c.deleted_at IS NULL
            `, [customer_id]);
    
            if (!customerRows[0]) return null;
    
            // Second query - check existence in customer_contracts and customer_kyc
            const [kycStatus] = await db.query(`
                SELECT 
                    EXISTS(SELECT 1 FROM customer_contracts WHERE customer_reference = ?) AS has_contract,
                    EXISTS(SELECT 1 FROM customer_kyc WHERE customer_id = ?) AS has_kyc
            `, [customer_id, customer_id]);
    
            // Third query - get KYC status if exists
            const [kycDetails] = await db.query(`
                SELECT status 
                FROM customer_kyc 
                WHERE customer_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            `, [customer_id]);
    
            // Calculate kyc submission level
            let is_kyc_submited = 0;
            if (kycStatus[0].has_contract && !kycStatus[0].has_kyc) {
                is_kyc_submited = 1;
            } else if (kycStatus[0].has_contract && kycStatus[0].has_kyc) {
                is_kyc_submited = 2;
            }
    
            // Determine KYC verification status
            let is_kyc_verified = "Not Submitted";
            if (kycDetails[0]) {
                is_kyc_verified = kycDetails[0].status;
                // Convert to more readable format if needed
                // is_kyc_verified = is_kyc_verified.charAt(0).toUpperCase() + is_kyc_verified.slice(1);
                // String(is_kyc_verified);
            }
    
            // Extract BASIC customer info (first row only)
            const firstRow = customerRows[0];
            const basicInfo = {
                customer_id: firstRow.customer_id,
                email: firstRow.email,
                phone: firstRow.phone,
                first_name: firstRow.first_name,
                last_name: firstRow.last_name,
                profile_picture: firstRow.profile_picture,
                date_of_birth: firstRow.date_of_birth,
                gender: firstRow.gender,
                isShippingTheSame: firstRow.isShippingTheSame,
                is_email_verified: firstRow.is_email_verified,
                is_kyc_submited: is_kyc_submited,
                is_kyc_verified: is_kyc_verified, 
                is_phone_verified: firstRow.is_phone_verified || null, 
                referral_code: firstRow.referral_code
            };
    
            // Extract ALL addresses
            const addresses = customerRows
                .filter(row => row.address_id) // Skip null addresses
                .map(row => ({
                    address_id: row.address_id,
                    address_type: row.address_type,
                    recipient_name: row.recipient_name,
                    address_line1: row.address_line1,
                    address_line2: row.address_line2,
                    city: row.city,
                    state: row.state,
                    postal_code: row.postal_code,
                    country: row.country,
                    is_default: Boolean(row.is_default),
                    notes: row.notes,
                    isShippingTheSame: Boolean(row.isShippingTheSame)
                }));
    
            return {
                BasicInfo: basicInfo,
                addresses: addresses
            };
        } catch (err) {
            logger.error('Failed to fetch customer with addresses', {
                customerId: customer_id,
                error: err.message
            });
            throw err;
        }
    },
    async update(id, data) {
        try {
          const [result] = await db.query(
            'UPDATE customers SET ? WHERE customer_id = ?', 
            [data, id]
          );
          
          if (result.affectedRows === 0) {
            throw new Error('Customer not found or no changes made');
          }
          
          return await this.findById(id);
        } catch (err) {
          logger.error('Customer update failed', {
            customerId: id,
            error: err.message,
            code: err.code
          });
          throw err;
        }
      },

    async softDelete(customer_id) {
        try {
            const [result] = await db.query(
                'UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE customer_id = ?',
                [customer_id]
            );
            return result;
        } catch (err) {
            logger.error(`Customer model softDelete error for ID ${customer_id}:`, {
                error: err.message,
                stack: err.stack,
                customerId: customer_id
            });
            throw err;
        }
    },

    async findByEmail(email) {
        try {
            const [rows] = await db.query(
                'SELECT * FROM customers WHERE email = ? AND deleted_at IS NULL',
                [email]
            );
            return rows[0];
        } catch (err) {
            logger.error(`Customer model findByEmail error for email ${email}:`, {
                error: err.message,
                stack: err.stack,
                email
            });
            throw err;
        }
    },
};
// Add near the bottom of your Customer model (before module.exports)
async function findByPhoneFlexible(phoneAnyFormat) {
  try {
    const justDigits = String(phoneAnyFormat || '').replace(/\D/g, '');

    // Try to match phones regardless of "+", spaces, or dashes
    const sql = `
      SELECT * 
      FROM customers 
      WHERE deleted_at IS NULL
        AND (
          REPLACE(REPLACE(REPLACE(phone, '+',''), ' ', ''), '-', '') = ?
          OR phone = ?
        )
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [justDigits, phoneAnyFormat]);
    return rows[0] || null;
  } catch (err) {
    logger.error(`Customer model findByPhoneFlexible error for ${phoneAnyFormat}:`, err);
    throw err;
  }
}

// export it
Customer.findByPhoneFlexible = findByPhoneFlexible;

module.exports = Customer;
