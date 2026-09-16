import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ContractModificationsService } from './contract-modifications.service';
import { CreateModificationDto } from './dto/create-modification.dto';

@ApiTags('contract-modifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts/:contractId/modifications')
export class ContractModificationsController {
  constructor(private readonly service: ContractModificationsService) {}

  @Get()
  list(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(contractId, user.id);
  }

  @Post()
  create(
    @Param('contractId') contractId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateModificationDto,
  ) {
    return this.service.create(contractId, user.id, dto);
  }
}
