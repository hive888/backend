const Interest = require('../models/interestModel');

exports.getInterests = async (req, res) => {
  try {
    const interests = await Interest.getAll();
    res.json({ success: true, data: interests });
  } catch (error) {
    console.error('Error in getInterests:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.getMyInterests = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const [interests, promptedAt] = await Promise.all([
      Interest.getForCustomer(customerId),
      Interest.getPromptedAt(customerId)
    ]);

    res.json({
      success: true,
      data: {
        interests,
        prompted_at: promptedAt
      }
    });
  } catch (error) {
    console.error('Error in getMyInterests:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

exports.saveMyInterests = async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    if (!customerId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { interest_ids } = req.body;
    if (!Array.isArray(interest_ids)) {
      return res.status(400).json({ success: false, error: 'interest_ids must be an array' });
    }

    await Interest.setForCustomer(customerId, interest_ids);

    const [interests, promptedAt] = await Promise.all([
      Interest.getForCustomer(customerId),
      Interest.getPromptedAt(customerId)
    ]);

    res.json({
      success: true,
      message: 'Interests saved',
      data: {
        interests,
        prompted_at: promptedAt
      }
    });
  } catch (error) {
    console.error('Error in saveMyInterests:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
