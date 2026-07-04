import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetricsData() {
    const currentYear = new Date().getFullYear();

    // 1. Gather Card Values
    const [
      totalUsers,
      totalTourPlans,
      paymentsData,
      totalBookings,
      totalMessages,
      totalReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tour.count(),
      this.prisma.payment.findMany({
        where: {
          status: { in: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED] },
        },
        select: { amount: true, refundedAmount: true },
      }),
      this.prisma.booking.count(),
      this.prisma.contact.count({ where: { isRead: false } }),
      this.prisma.review.count(),
    ]);

    const totalIncome = paymentsData.reduce(
      (sum, item) => sum + (item.amount - (item.refundedAmount ?? 0)),
      0,
    );

    // 2. Fetch Aggregated Metrics for Timelines
    const [
      monthlyUsers,
      monthlyBookings,
      monthlyPayments,
      monthlyMessages,
      monthlyReviews,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: new Date(`${currentYear}-01-01`) } },
        select: { createdAt: true },
      }),
      this.prisma.booking.findMany({
        where: { createdAt: { gte: new Date(`${currentYear}-01-01`) } },
        select: { createdAt: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: { in: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED] },
          createdAt: { gte: new Date(`${currentYear}-01-01`) },
        },
        select: { createdAt: true, amount: true, refundedAmount: true },
      }),
      this.prisma.contact.findMany({
        where: { createdAt: { gte: new Date(`${currentYear}-01-01`) } },
        select: { createdAt: true },
      }),
      this.prisma.review.findMany({
        where: { createdAt: { gte: new Date(`${currentYear}-01-01`) } },
        select: { createdAt: true },
      }),
    ]);

    // Initialize 12 Months
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyMap = monthNames.map((month) => ({
      month,
      users: 0,
      bookings: 0,
      income: 0,
      messages: 0,
      reviews: 0,
    }));

    // Populate Users count per month
    monthlyUsers.forEach((u) => {
      const m = u.createdAt.getMonth();
      monthlyMap[m].users += 1;
    });

    // Populate Bookings count per month
    monthlyBookings.forEach((b) => {
      const m = b.createdAt.getMonth();
      monthlyMap[m].bookings += 1;
    });

    // Populate Income values per month
    monthlyPayments.forEach((p) => {
      const m = p.createdAt.getMonth();
      const netMonthlyIncome = p.amount - (p.refundedAmount ?? 0);
      monthlyMap[m].income += netMonthlyIncome;
    });

    // Populate Messages count per month
    monthlyMessages.forEach((msg) => {
      const m = msg.createdAt.getMonth();
      monthlyMap[m].messages += 1;
    });

    // Populate Reviews count per month
    monthlyReviews.forEach((r) => {
      const m = r.createdAt.getMonth();
      monthlyMap[m].reviews += 1;
    });

    return {
      cards: {
        totalUsers,
        totalTourPlans,
        totalIncome,
        totalBookings,
        totalMessages,
        totalReviews,
      },
      monthlyData: monthlyMap,
    };
  }
}
