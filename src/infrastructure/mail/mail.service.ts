import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { getInquiryTemplate } from './templates/inquiry-template';
import { getBookingTemplate } from './templates/booking-template';

interface BookingsEmail {
  tourTitle: string;
  userName: string;
  travelDate: Date;
  paxCount: number;
  amount: number;
}

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  /**
   * INQUIRY ALERT
   */
  async sendInquiryAlert(unreadCount: number = 1) {
    try {
      await this.resend.emails.send({
        from: 'Tourvista Tours Inquiries <info@tourvistatours.com>',
        to: [process.env.ADMIN_EMAIL] as string[],
        subject: `🔔 Unread Messages Alert (${unreadCount})`,
        html: getInquiryTemplate(unreadCount),
      });
    } catch (error) {
      this.logger.error(
        `Inquiry Alert failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * BOOKING NOTIFICATION
   */
  async sendBookingDetail(bookingData: BookingsEmail) {
    try {
      await this.resend.emails.send({
        from: 'Tourvista Tours Bookings <support@tourvistatours.com>',
        to: [process.env.ADMIN_EMAIL] as string[],
        subject: `🎒 New Booking: ${bookingData.tourTitle}`,
        html: getBookingTemplate(bookingData),
      });
    } catch (error: any) {
      this.logger.error(
        `Booking Notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
