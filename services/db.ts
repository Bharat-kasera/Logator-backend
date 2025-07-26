import pool from '../config/db';
import { User } from '../types';

export const userService = {
  async createUser(phone: string): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (phone) VALUES ($1) RETURNING *',
      [phone]
    );
    return result.rows[0];
  },

  async getUserByPhone(phone: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0] || null;
  },
};
