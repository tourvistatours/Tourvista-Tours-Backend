import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(@Inject('CLOUDINARY') private v2: typeof cloudinary) {}

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    existingPublicId?: string,
    data?: { title: string | undefined; location: string | undefined },
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const publicId = existingPublicId
        ? existingPublicId.split('/').pop()
        : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      const upload = this.v2.uploader.upload_stream(
        {
          folder: folder,
          public_id: publicId,
          overwrite: true,
          invalidate: true,
          transformation: [
            { width: 1280, height: 720, crop: 'fill', gravity: 'auto' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
          context: { alt: data?.title, caption: data?.location },
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );

      upload.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.v2.uploader.destroy(
        publicId,
        { invalidate: true },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  extractPublicId(url: string): string {
    const parts = url.split('/');
    const uploadIndex = parts.findIndex((part) => part === 'upload');
    const publicIdWithExtension = parts.slice(uploadIndex + 2).join('/');
    return publicIdWithExtension.split('.')[0];
  }
}
