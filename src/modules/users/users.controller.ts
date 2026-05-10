import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserQueryDto } from './dto/query-user.dto';
import { ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';

@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Returns total number of users' })
  getStats() {
    return this.usersService.getStats();
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Returns all users with optional filtering' })
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }
}
