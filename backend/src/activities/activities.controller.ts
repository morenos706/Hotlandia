import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get('obligations/:obligationId/activities')
  list(@Param('obligationId') obligationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(obligationId, user.id);
  }

  @Post('obligations/:obligationId/activities')
  create(
    @Param('obligationId') obligationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityDto,
  ) {
    return this.service.create(obligationId, user.id, dto);
  }

  @Get('activities/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOneOwned(id, user.id);
  }

  @Patch('activities/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.service.update(id, user.id, dto);
  }
}
