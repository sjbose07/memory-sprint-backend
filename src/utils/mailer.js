const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: (process.env.EMAIL_USER || '').trim(),
    pass: (process.env.EMAIL_PASS || '').replace(/\s/g, ''), // Remove all spaces
  },
});

const sendResetEmail = async (email, token) => {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:6020'}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"MCQ Practice Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #3c50e0;">Password Reset Request</h2>
        <p>You requested a password reset for your MCQ Practice account.</p>
        <p>Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3c50e0; color: #fff; text-decoration: none; rounded: 8px; font-weight: bold;">Reset Password</a>
        <p style="margin-top: 20px; font-size: 12px; color: #777;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:6020'}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"MCQ Practice Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #3c50e0;">Email Verification</h2>
        <p>Please verify your email address to complete your registration or security update.</p>
        <div style="background: #f4f7ff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <a href="${verifyUrl}" style="font-size: 18px; color: #3c50e0; font-weight: bold; text-decoration: none;">Verify My Email Address</a>
        </div>
        <p style="font-size: 12px; color: #777;">This verification link will expire in 24 hours.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail, sendVerificationEmail };
