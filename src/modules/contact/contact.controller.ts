import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ContactService } from './contact.service';

import { CreateContactDto } from './dto/create-contact.dto';
import { FilterContactDto } from './dto/filter-contact.dto';

import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';

@Controller('v1/contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  create(@Body() body: CreateContactDto) {
    return this.contactService.create(body);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query() query: FilterContactDto) {
    return this.contactService.findAll(query);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN)
  updateIsRead(@Param('id') id: string, @Body('isRead') isRead: boolean) {
    return this.contactService.updateIsRead(+id, isRead);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.contactService.remove(+id);
  }
}
