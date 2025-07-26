const express = require('express');
const router = express.Router();
const db = require('../db'); // or wherever your knex/prisma is

router.post('/update-plan', async (req, res) => {
  const { userId, plan } = req.body;
  try {
    await db('users').where({ id: userId }).update({ plan });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update plan:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
