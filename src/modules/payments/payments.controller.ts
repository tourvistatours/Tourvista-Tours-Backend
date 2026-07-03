import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Headers,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Role } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { ApiOperation } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('/stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Returns total number of payments' })
  getStats() {
    return this.paymentsService.getStats();
  }

  @Post('/initiate')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Initiates a secure payment intent config for PayHere',
  })
  initiatePayment(
    @GetUser('id') userId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.initiatePaymentIntent(userId, createPaymentDto);
  }

  @Post('/webhook')
  @Public()
  @ApiOperation({
    summary: 'Asynchronous notification endpoint for PayHere gateway',
  })
  handleWebhook(
    @Headers('x-notification-secret') secret: string,
    @Body() payload: any,
  ) {
    return this.paymentsService.processWebhook(secret, payload);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Returns all payments' })
  findAll(@Query() query: QueryPaymentDto) {
    return this.paymentsService.findAll(query);
  }

  @Patch(':id/refund')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Admin initiated database ledger entry reversal and parent booking state reduction',
  })
  async refund(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.refund(Number(id));
  }
}
