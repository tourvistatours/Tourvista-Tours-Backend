import { BadRequestException } from '@nestjs/common';

export class FileValidatorUtil {
  private static readonly MAX_SIZE = 1024 * 1024 * 2; // 2MB
  private static readonly ALLOWED_TYPES = /^image\/(jpeg|png|jpg|webp)$/;

  static validate(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(
        `File ${file.originalname} is too large (Max 2MB)`,
      );
    }

    if (!this.ALLOWED_TYPES.test(file.mimetype)) {
      throw new BadRequestException(
        `File ${file.originalname} has an invalid type. Allowed: jpeg, png, jpg, webp`,
      );
    }
  }

  static validateMany(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }
    files.forEach((file) => this.validate(file));
  }
}
