export const getInquiryTemplate = (unreadCount: number) => `
  <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 40px 10px;">
    <div style="max-width: 600px; margin: 0 auto;">
      <!-- Logo/Brand Header -->
      <div style="padding-bottom: 20px; text-align: center;">
        <h1 style="color: #0ea5e9; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">TOURVISTA</h1>
      </div>

      <!-- Main Card -->
      <div style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
        <div style="background-color: #0ea5e9; padding: 40px; text-align: center;">
            <div style="background: rgba(255, 255, 255, 0.2); width: 80px; height: 80px; border-radius: 50%; line-height: 80px; margin: 0 auto; font-size: 40px;">✉️</div>
        </div>
        
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin-bottom: 12px; letter-spacing: -0.025em;">New Inquiries Received</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Hello Admin, you have <span style="color: #0ea5e9; font-weight: 700;">${unreadCount}</span> new unread customer messages waiting for a response.
          </p>
          
          <a href="https://tourvistatours.com/dashboard/admin/community-center/inquiries" 
             style="display: inline-block; padding: 14px 32px; background-color: #0ea5e9; color: #ffffff; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; transition: background-color 0.2s;">
             View Dashboard
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding-top: 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">
          Sent to <strong>admin@tourvistatours.com</strong>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 8px;">
          © ${new Date().getFullYear()} Tourvista Tours. All rights reserved.
        </p>
      </div>
    </div>
  </div>
`;
