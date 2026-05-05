import { Inject, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

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

      const context: Record<string, string> = {};
      if (data?.title) context.alt = data.title;
      if (data?.location) context.caption = data.location;

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
          ...(Object.keys(context).length > 0 ? { context } : {}),
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

  async deleteFolderRecursive(folderPath: string): Promise<void> {
    try {
      await this.v2.api.delete_resources_by_prefix(folderPath + '/');

      const { folders } = await this.v2.api.sub_folders(folderPath);
      for (const sub of folders) {
        await this.v2.api.delete_resources_by_prefix(sub.path);
        await this.v2.api.delete_folder(sub.path);
      }

      await this.v2.api.delete_folder(folderPath);

      this.logger.log(`Cloudinary folder deleted: ${folderPath}`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown Cloudinary Error';
      const errorCode = error?.http_code || 'N/A';

      this.logger.warn(
        `Cleanup failed [Code: ${errorCode}]: ${errorMessage} - Path: ${folderPath}`,
      );
    }
  }
}
