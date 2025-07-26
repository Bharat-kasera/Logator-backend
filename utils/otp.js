// Dummy OTP module (shared by login and register)
exports.sendOtp = (phone) => {
  // Dummy OTP logic: always use 123456
  console.log(`Sending OTP 123456 to ${phone}`);
  return '123456';
};
