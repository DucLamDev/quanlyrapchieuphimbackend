import nodemailer from 'nodemailer';
import { logger } from './logger.js';

let transporter = null;

if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  logger.info('✅ Email service configured');
} else {
  logger.warn('⚠️  Email service not configured - emails will not be sent');
}

export const sendEmail = async (options) => {
  if (!transporter) {
    logger.warn(`Email not sent to ${options.email} - email service not configured`);
    return true;
  }

  try {
    const mailOptions = {
      from: `Cinema Management <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.html
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.email}`);
    return true;
  } catch (error) {
    logger.error('Email sending failed:', error);
    return false;
  }
};

export const sendBookingConfirmation = async (booking, user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e50914;">Xác Nhận Đặt Vé</h2>
      <p>Xin chào ${user.fullName},</p>
      <p>Cảm ơn bạn đã đặt vé tại rạp chiếu phim của chúng tôi!</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Thông tin đặt vé:</h3>
        <p><strong>Mã đặt vé:</strong> ${booking.bookingCode}</p>
        <p><strong>Tổng tiền:</strong> ${booking.finalAmount.toLocaleString('vi-VN')} VNĐ</p>
        <p><strong>Trạng thái:</strong> ${booking.status}</p>
      </div>
      
      <p>Vui lòng mang mã QR hoặc mã đặt vé đến quầy để nhận vé.</p>
      <p>Trân trọng,<br>Cinema Management Team</p>
    </div>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Xác nhận đặt vé thành công',
    html
  });
};

export const sendPasswordReset = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e50914;">Đặt Lại Mật Khẩu</h2>
      <p>Xin chào ${user.fullName},</p>
      <p>Bạn đã yêu cầu đặt lại mật khẩu. Click vào link bên dưới để tiếp tục:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background: #e50914; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Đặt Lại Mật Khẩu
        </a>
      </div>
      
      <p>Link này sẽ hết hạn sau 10 phút.</p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      
      <p>Trân trọng,<br>Cinema Management Team</p>
    </div>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Yêu cầu đặt lại mật khẩu',
    html
  });
};
