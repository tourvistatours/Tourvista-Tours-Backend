import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Role } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { QueryPaymentDto } from './dto/query-payment.dto';

@Controller('v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.USER)
  create(
    @GetUser('id') userId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(userId, createPaymentDto);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  findAll(@Query() query: QueryPaymentDto) {
    return this.paymentsService.findAll(query);
  }

  @Patch(':id')
  @Roles(Role.USER)
  update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() paymentPayload: {},
  ) {
    return this.paymentsService.update(+id, userId, paymentPayload);
  }
}
