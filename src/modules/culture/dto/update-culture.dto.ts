import { PartialType } from '@nestjs/swagger';
import { CreateCultureDto } from './create-culture.dto';

export class UpdateCultureDto extends PartialType(CreateCultureDto) {}
