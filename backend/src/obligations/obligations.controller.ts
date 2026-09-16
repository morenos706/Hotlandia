import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ObligationsService } from './obligations.service';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { UpdateObligationDto } from './dto/update-obligation.dto';

@ApiTags('obligations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ObligationsController {
  constructor(private readonly service: ObligationsService) {}

  @Get('contracts/:contractId/obligations')
  list(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(contractId, user.id);
  }

  @Post('contracts/:contractId/obligations')
  create(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateObligationDto,
  ) {
    return this.service.create(contractId, user.id, dto);
  }

  @Patch('obligations/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateObligationDto,
  ) {
    return this.service.update(id, user.id, dto);
  }
}
