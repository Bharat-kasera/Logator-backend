import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const twilioService = {
  async sendOTP(phone: string): Promise<string> {
    try {
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications
        .create({
          to: phone,
          channel: 'sms'
        });

      return verification.status;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  },

  async verifyOTP(phone: string, code: string): Promise<boolean> {
    try {
      const verificationCheck = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks
        .create({
          to: phone,
          code: code
        });

      return verificationCheck.status === 'approved';
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  }
};
