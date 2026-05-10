import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Patch,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { Role } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QueryReviewDto } from './dto/query-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { ApiOperation } from '@nestjs/swagger';

@Controller('v1/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('stats')
  @Roles(Role.ADMIN)
  getStats() {
    return this.reviewsService.getStats();
  }

  @Get('featured')
  @Public()
  @ApiOperation({
    summary: 'Public: Get top 10 featured/high-rated reviews for landing page',
  })
  getFeaturedReviews() {
    return this.reviewsService.getFeatured();
  }

  @Post()
  @Roles(Role.USER)
  @ApiOperation({ summary: 'User: Create a new review' })
  create(@GetUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Authenticated: Get all visible reviews paginated' })
  findAll(@Query() query: QueryReviewDto, @GetUser('role') role: Role) {
    return this.reviewsService.findAll(query, role);
  }

  @Patch(':id')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'User: Update a review' })
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(id, dto);
  }

  @Patch(':id/visibility')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Toggle review visibility' })
  updateVisibility(
    @Param('id') id: string,
    @Body('isVisible') isVisible: boolean,
  ) {
    return this.reviewsService.updateAdminFields(id, { isVisible });
  }

  @Patch(':id/featured')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Toggle featured status' })
  updateFeatured(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.reviewsService.updateAdminFields(id, { isFeatured });
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Delete a review' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
