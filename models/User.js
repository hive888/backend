const db = require('../config/database');
const logger = require('../utils/logger');

const User = {
    async create(userData) {
        try {
            // Remove undefined values and fields not in schema
            const allowedFields = ['user_id', 'customer_id', 'username', 'password_hash', 'role_id'];
const cleanData = Object.fromEntries(
    Object.entries(userData)
        .filter(([k, v]) => v !== undefined && allowedFields.includes(k))
);
            const [result] = await db.query(
                `INSERT INTO users SET ?`,
                [cleanData]
            );
            return result;
        } catch (err) {
            logger.error('User model create error:', err);
            throw err;
        }
    },
    async findAll({ limit, offset, role_id, username } = {}) {
        try {
            // Base query
            let query = `
                SELECT u.*, r.role_name 
                FROM users u
                JOIN roles r ON u.role_id = r.role_id
            `;
            
            const conditions = [];
            const params = [];
            
            // Add filters if provided
            if (role_id) {
                conditions.push('u.role_id = ?');
                params.push(role_id);
            }
            
            if (username) {
                conditions.push('u.username LIKE ?');
                params.push(`%${username}%`);
            }
            
            // Add WHERE clause if there are conditions
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            // Add pagination
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
            
            // Execute query
            const [users] = await db.query(query, params);
            
            // Get total count for pagination
            let countQuery = 'SELECT COUNT(*) as total FROM users u';
            if (conditions.length > 0) {
                countQuery += ' WHERE ' + conditions.join(' AND ');
            }
            
            const [total] = await db.query(countQuery, params.slice(0, -2)); // Remove limit/offset params
            
            return {
                users,
                totalCount: total[0].total
            };
        } catch (err) {
            logger.error('User model findAll error:', err);
            throw err;
        }
    },

    async findById(user_id) {
        try {
            const [rows] = await db.query(
                `SELECT u.*, r.role_name 
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE u.user_id = ?`,
                [user_id]
            );
            return rows[0];
        } catch (err) {
            logger.error(`User model findById error for ID ${user_id}:`, err);
            throw err;
        }
    },
    async findByEmail(email) {
        try {
            const [rows] = await db.query(
                `SELECT u.*, r.role_name 
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE u.username = ?`,
                [email]
            );
            return rows[0];
        } catch (err) {
            logger.error(`User model findById error for ID ${email}:`, err);
            throw err;
        }
    },
    async update(user_id, updateData) {
        try {
            // Remove password_hash if empty to prevent clearing it accidentally
            if (updateData.password_hash === '') {
                delete updateData.password_hash;
            }

            const [result] = await db.query(
                `UPDATE users SET ? WHERE user_id = ?`,
                [updateData, user_id]
            );
            return result;
        } catch (err) {
            logger.error(`User model update error for ID ${user_id}:`, err);
            throw err;
        }
    },

async findByUsername(username) {
  const [rows] = await db.query(
    `SELECT 
       u.*,
       GROUP_CONCAT(r.role_name ORDER BY r.role_name SEPARATOR ',') AS roles_csv
     FROM users u
     LEFT JOIN roles r
       ON FIND_IN_SET(r.role_id, REPLACE(u.role_id, ' ', '')) > 0
     WHERE u.username = ?
     GROUP BY u.user_id`,
    [username]
  );
  const user = rows[0];
  if (!user) return null;
  user.roles = (user.roles_csv || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return user;
}


,
    async findByname(username) {
        try {
            const [rows] = await db.query(
                `SELECT u.*, r.role_name 
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE u.username = ?`,
                [username]
            );
            return rows[0];
        } catch (err) {
            logger.error(`User model findByUsername error for ${username}:`, err);
            throw err;
        }
    },
    async findByIdAndUpdate(customer_id, updateData) {

        try {
            // Remove undefined values and fields not in schema
            const allowedFields = ['is_email_verified'];
            const cleanData = Object.fromEntries(
                Object.entries(updateData)
                    .filter(([k, v]) => v !== undefined && allowedFields.includes(k))
            );
            if (!customer_id) {
                throw new Error("user_id is missing or invalid");
            }
            const [result] = await db.query(
                `UPDATE customers SET ? WHERE customer_id = ?`,
                [cleanData, customer_id]
            );

            if (result.affectedRows === 0) {
                return null;
            }

            // Return the updated user data
            return await this.findById(customer_id);
        } catch (err) {
            logger.error(`User model findByIdAndUpdate error for ID ${customer_id}:`, err);
            throw err;
        }
    },
    async findByCustomerId(customer_id) {
        try {
            const [rows] = await db.query(
                `SELECT * FROM users WHERE customer_id = ?`,
                [customer_id]
            );
            return rows[0];
        } catch (err) {
            logger.error(`User model findByCustomerId error for ${customer_id}:`, err);
            throw err;
        }
    },

    // NEW METHODS FOR TOKEN VERSION SUPPORT
    async incrementTokenVersion(user_id) {
        try {
            const [result] = await db.query(
                `UPDATE users 
                 SET token_version = token_version + 1 
                 WHERE user_id = ?`,
                [user_id]
            );
            return result.affectedRows > 0;
        } catch (err) {
            logger.error(`Token version increment error for user ${user_id}:`, err);
            throw err;
        }
    },

    async getTokenVersion(user_id) {
        try {
            const [rows] = await db.query(
                `SELECT token_version FROM users WHERE user_id = ?`,
                [user_id]
            );
            return rows[0]?.token_version || 0;
        } catch (err) {
            logger.error(`Token version check error for user ${user_id}:`, err);
            throw err;
        }
    },

    // Utility method for authentication
    async getUserWithRoles(user_id) {
        try {
            const [rows] = await db.query(
                `SELECT u.*, r.role_name 
                 FROM users u
                 JOIN roles r ON u.role_id = r.role_id
                 WHERE u.user_id = ?`,
                [user_id]
            );
            return rows[0];
        } catch (err) {
            logger.error(`Get user with roles error for ID ${user_id}:`, err);
            throw err;
        }
    },
    async createRole(role_name) {
        try {
            const [result] = await db.query(
                `INSERT INTO roles (role_name) VALUES (?)`,
                [role_name]
            );
            
            // Return the newly created role
            const [roles] = await db.query(
                `SELECT * FROM roles WHERE role_id = ?`,
                [result.insertId]
            );
            
            return roles[0];
        } catch (err) {
            logger.error('Role creation error:', err);
            throw err;
        }
    },
    
    /**
     * Find role by name
     */
    async findRoleByName(role_name) {
        try {
            const [rows] = await db.query(
                `SELECT * FROM roles WHERE role_name = ?`,
                [role_name]
            );
            return rows[0];
        } catch (err) {
            logger.error(`Find role by name error for ${role_name}:`, err);
            throw err;
        }
    },
    
    /**
     * Get all roles
     */
    async findAllRoles() {
        try {
            const [roles] = await db.query(
                `SELECT * FROM roles ORDER BY role_name`
            );
            return roles;
        } catch (err) {
            logger.error('Find all roles error:', err);
            throw err;
        }
    },
    
    /**
     * Get statistics of users per role
     */
    async getRoleStatistics() {
        try {
            const [stats] = await db.query(`
                SELECT 
                    r.role_id,
                    r.role_name,
                    COUNT(u.user_id) as user_count
                FROM 
                    roles r
                LEFT JOIN 
                    users u ON r.role_id = u.role_id
                GROUP BY 
                    r.role_id, r.role_name
                ORDER BY 
                    r.role_name
            `);
            
            return stats;
        } catch (err) {
            logger.error('Role statistics error:', err);
            throw err;
        }
    }
};

module.exports = User;