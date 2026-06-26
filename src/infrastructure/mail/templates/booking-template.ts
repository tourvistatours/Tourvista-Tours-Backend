export const getBookingTemplate = (data: any) => `
  <div style="font-family: 'Inter', sans-serif; background-color: #f8fafc; padding: 40px 10px;">
    <div style="max-width: 600px; margin: 0 auto;">
      <div style="padding-bottom: 20px; text-align: center;">
        <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 800;">Tourvista Tours</h1>
      </div>

      <div style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; color: white;">
          <p style="text-transform: uppercase; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; opacity: 0.9;">New Reservation</p>
          <h2 style="margin: 0; font-size: 28px; font-weight: 800;">Amound: $${data.amount}</h2>
        </div>

        <div style="padding: 40px;">
          <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
            <h3 style="color: #0f172a; font-size: 18px; margin: 0 0 4px 0;">${data.tourTitle}</h3>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Booking ID: #${Math.floor(Math.random() * 100000)}</p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b; font-size: 14px;">Customer</span>
              <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.userName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px;">
              <span style="color: #64748b; font-size: 14px;">Date</span>
              <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${new Date(data.travelDate).toLocaleDateString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px;">
              <span style="color: #64748b; font-size: 14px;">Travelers</span>
              <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.paxCount} People</span>
            </div>
          </div>

          <a href="https://tourvistatours.com/dashboard/admin/operations/reservations" 
             style="display: block; text-align: center; margin-top: 35px; padding: 14px; background-color: #0f172a; color: #ffffff; border-radius: 12px; text-decoration: none; font-weight: 600;">
             Manage Booking
          </a>
        </div>
      </div>
    </div>
  </div>
`;
