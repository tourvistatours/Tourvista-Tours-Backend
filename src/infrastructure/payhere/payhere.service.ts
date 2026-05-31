import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PayhereService {
  constructor(@Inject('PAYHERE') private payhere: any) {}

  private md5(string: string): string {
    return crypto.createHash('md5').update(string).digest('hex').toUpperCase();
  }

  /**
   * Generates parameters and cryptographically seals the initial payload signature string sequence
   */
  async generatePaymentPayload(
    orderId: string,
    amount: number,
    user: { firstName: string; lastName: string; email: string },
  ) {
    const formattedAmount = amount.toFixed(2);
    const currency = 'USD'; // Switch to 'LKR' if operating locally inside Sri Lanka

    const secretHash = this.md5(this.payhere.merchantSecret);
    const mainHash = this.md5(
      this.payhere.merchantId +
        orderId +
        formattedAmount +
        currency +
        secretHash,
    );

    return {
      merchant_id: this.payhere.merchantId,
      order_id: orderId,
      amount: formattedAmount,
      currency: currency,
      hash: mainHash,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
    };
  }

  /**
   * Strictly verifies incoming webhook authenticity calculations
   */
  verifyWebhookSignature(body: any): boolean {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = body;

    const secretHash = this.md5(this.payhere.merchantSecret);
    const localSignature = this.md5(
      merchant_id +
        order_id +
        payhere_amount +
        payhere_currency +
        status_code +
        secretHash,
    );

    if (localSignature !== md5sig) {
      throw new BadRequestException(
        'Cryptographic mismatch: Webhook tampering detected.',
      );
    }

    return true;
  }
}
