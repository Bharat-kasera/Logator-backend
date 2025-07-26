// components/otpChecker.js
// Dummy OTP checker module (easily swappable for a real service later)

/**
 * Checks if the provided OTP is valid for the given phone number.
 * For now, always accepts '123456' as valid (dummy logic).
 * @param {string} phone - The phone number to check OTP for
 * @param {string} otp - The OTP code to verify
 * @returns {boolean} - True if OTP is valid, false otherwise
 */
function checkOtp(phone, otp) {
  // Dummy: always accept 123456
  return otp === '123456';
}

module.exports = { checkOtp };
