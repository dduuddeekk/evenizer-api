import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorResponse } from '../common/dto';

@Injectable()
export class UploadService {
  async saveImage(file: Express.Multer.File, category: 'profile' | 'banner' | 'logo', uuid: string): Promise<string> {
    try {
      if (!file) {
        throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new HttpException('Invalid file type. Only JPG, PNG, and WEBP are allowed', HttpStatus.BAD_REQUEST);
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new HttpException('File size exceeds 5MB limit', HttpStatus.BAD_REQUEST);
      }

      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${uuid}${ext}`;
      
      // Using src/storage/img since the static assets map /storage to src/storage
      const uploadDir = path.join(__dirname, '..', '..', 'src', 'storage', 'img', category);
      
      // Ensure directory exists (though we created .gitkeep, good to be safe)
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, filename);

      await fs.promises.writeFile(filePath, file.buffer);
      // Return the public URL path
      return `/storage/img/${category}/${filename}`;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to save file', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
