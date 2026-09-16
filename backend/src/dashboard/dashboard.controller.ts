import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('dashboard')
  getGlobal(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getGlobalDashboard(user.id);
  }

  @Get('contracts/:id/dashboard')
  getContract(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getContractDashboard(id, user.id);
  }
}
