import QRCode from 'qrcode';
import { logger } from './logger.js';

export const generateQRCode = async (data) => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(data), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL;
  } catch (error) {
    logger.error('QR Code generation failed:', error);
    throw error;
  }
};

export const generateBookingQR = async (booking) => {
  const qrData = {
    bookingCode: booking.bookingCode,
    userId: booking.userId,
    showtimeId: booking.showtimeId,
    seats: booking.seats,
    timestamp: Date.now()
  };
  
  return await generateQRCode(qrData);
};
