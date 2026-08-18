const db = require('../config/database');

async function run() {
  try {
    // Check if the code already exists
    const [existing] = await db.query('SELECT * FROM access_codes WHERE code = ?', ['ACTPTGR']);
    
    if (existing.length > 0) {
      console.log('Access code ACTPTGR already exists, updating...');
      await db.query(`
        UPDATE access_codes 
        SET payment_amount = 0.00, 
            course_id = 2, 
            is_active = 1,
            max_uses = 10000,
            notes = 'Free access code for testing'
        WHERE code = 'ACTPTGR'
      `);
      console.log('Update complete.');
    } else {
      console.log('Access code ACTPTGR does not exist, inserting...');
      await db.query(`
        INSERT INTO access_codes 
        (code, course_id, payment_amount, payment_currency, max_uses, used_count, is_active, notes, label)
        VALUES ('ACTPTGR', 2, 0.00, 'USD', 10000, 0, 1, 'Free access code for testing', 'Free Access')
      `);
      console.log('Insert complete.');
    }

    const [updated] = await db.query('SELECT * FROM access_codes WHERE code = ?', ['ACTPTGR']);
    console.log('Final access code row in DB:', updated[0]);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.close();
  }
}

run();
