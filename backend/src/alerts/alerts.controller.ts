import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get('contracts/:contractId/alerts')
  async list(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.evaluateContract(contractId);
    return this.service.list(contractId, user.id);
  }

  @Patch('alerts/:id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.resolve(id, user.id);
  }
}
