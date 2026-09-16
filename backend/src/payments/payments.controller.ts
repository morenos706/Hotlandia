import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('contracts/:contractId/payments')
  list(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(contractId, user.id);
  }

  @Post('contracts/:contractId/payments')
  create(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.service.create(contractId, user.id, dto);
  }

  @Patch('payments/:id')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePaymentDto) {
    return this.service.update(id, user.id, dto);
  }
}
