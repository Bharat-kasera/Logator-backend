const express = require('express');
const router = express.Router();
const knex = require('../db/knex'); // Using knex directly

router.post('/update-plan', async (req, res) => {
  const { userId, plan } = req.body;
  try {
    await knex('users').where({ id: userId }).update({ plan });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update plan:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Update user profile endpoint (for Profile.tsx)
router.post('/update-profile', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { firstname, lastname, email, photo_url, representing } = req.body;

    const updatedUser = await knex('users')
      .where({ id: userId })
      .update({
        firstname,
        lastname,
        email,
        photo_url,
        representing,
        updated_at: knex.fn.now()
      })
      .returning(['id', 'firstname', 'lastname', 'email', 'phone', 'country_code', 'photo_url', 'representing', 'plan']);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser[0]
    });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Update user profile endpoint (for Settings.tsx)
router.put('/user/profile', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { firstname, lastname, email, phone, country_code } = req.body;

    const updatedUser = await knex('users')
      .where({ id: userId })
      .update({
        firstname,
        lastname,
        email,
        phone,
        country_code,
        updated_at: knex.fn.now()
      })
      .returning(['id', 'firstname', 'lastname', 'email', 'phone', 'country_code', 'photo_url', 'representing', 'plan']);

    res.json(updatedUser[0]);
  } catch (err) {
    console.error('Failed to update user profile:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Delete user account endpoint (for Settings.tsx)
router.delete('/user/delete', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Delete user account (cascade will handle related data)
    await knex('users').where({ id: userId }).del();

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Failed to delete user account:', err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;
