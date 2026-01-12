// services/otpService.js
const SMSService = require('./smsService');

class OTPService {
  constructor() {
    this.otpStore = new Map();
    this.OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
    
    // Clean up expired OTPs every hour
    setInterval(() => this.cleanupExpiredOTPs(), 60 * 60 * 1000);
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(phone, channel = 'sms') {
    const otp = this.generateOTP();
    const expiryTime = Date.now() + this.OTP_EXPIRY_MS;

    // Store OTP with expiry
    this.otpStore.set(phone, {
      code: otp,
      expiry: expiryTime,
      attempts: 0
    });

    console.log('💾 [OTP Service] Stored OTP for:', phone);
    console.log('🔢 [OTP Service] OTP stored:', otp);
    console.log('⏰ [OTP Service] Expires at:', new Date(expiryTime).toISOString());

    if (channel === 'sms') {
      const message = `Your verification code is: ${otp}. Valid for 10 minutes.`;
      return await SMSService.sendSMS(phone, message);
    }

    throw new Error('Unsupported channel');
  }

  async checkOTP(phone, code) {
    console.log('🔍 [OTP Service] Checking OTP for:', phone);
    console.log('🔢 [OTP Service] Code to verify:', code);
    console.log('🗂️ [OTP Service] Current store keys:', Array.from(this.otpStore.keys()));
    
    const stored = this.otpStore.get(phone);
    
    if (!stored) {
      console.log('❌ [OTP Service] No OTP found for phone:', phone);
      return { status: 'rejected', reason: 'No OTP requested for this number' };
    }

    console.log('📦 [OTP Service] Stored data:', stored);

    // Check if OTP expired
    if (Date.now() > stored.expiry) {
      this.otpStore.delete(phone);
      console.log('⏰ [OTP Service] OTP expired for:', phone);
      return { status: 'rejected', reason: 'OTP expired' };
    }

    // Increment attempts
    stored.attempts += 1;

    console.log('🔢 [OTP Service] Comparing codes - Stored:', stored.code, 'Received:', code);
    console.log('🔍 [OTP Service] Code match:', stored.code === code);

    if (stored.code !== code) {
      console.log('❌ [OTP Service] Invalid code for:', phone);
      return { status: 'rejected', reason: 'Invalid code' };
    }

    // OTP verified successfully
    this.otpStore.delete(phone);
    console.log('✅ [OTP Service] OTP verified successfully for:', phone);
    return { status: 'approved' };
  }

  cleanupExpiredOTPs() {
    const now = Date.now();
    let cleaned = 0;
    for (const [phone, data] of this.otpStore.entries()) {
      if (now > data.expiry) {
        this.otpStore.delete(phone);
        cleaned++;
      }
    }
    console.log(`🧹 [OTP Service] Cleaned up ${cleaned} expired OTPs`);
  }
}

// Export as singleton instance
module.exports = new OTPService();