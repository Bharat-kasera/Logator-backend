// COMMENTED OUT FOR TESTING - USING HARDCODED OTP INSTEAD
// import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// COMMENTED OUT TWILIO CLIENT FOR TESTING
// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

export const twilioService = {
  async sendOTP(phone: string): Promise<string> {
    // TESTING MODE: Always return success without calling Twilio
    console.log('🚀 TESTING MODE: Mock OTP sent to', phone);
    console.log('📱 Use hardcoded OTP: 123456');
    return 'pending'; // Mock successful status
    
    /* COMMENTED OUT TWILIO CODE FOR TESTING
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
    */
  },

  async verifyOTP(phone: string, code: string): Promise<boolean> {
    // TESTING MODE: Always use hardcoded OTP
    const isValid = code === '123456';
    console.log('🔍 TESTING MODE: OTP verification for', phone, '- OTP:', code, '- Valid:', isValid);
    return isValid;
    
    /* COMMENTED OUT TWILIO CODE FOR TESTING
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
    */
  }
};
