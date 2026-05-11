import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { ErrorResponse } from '../common/dto';
import type { UploadedFile as UploadedFileData } from '../common/types';

const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024;
const IMAGE_COMPRESSION_STEPS = [
  { quality: 82, width: 1600 },
  { quality: 72, width: 1440 },
  { quality: 62, width: 1280 },
  { quality: 52, width: 1080 },
  { quality: 42, width: 960 },
  { quality: 32, width: 800 },
  { quality: 24, width: 640 },
];

function getStorageRoot() {
  return process.env.VERCEL
    ? path.join('/tmp', 'evenizer-storage')
    : path.join(process.cwd(), 'src', 'storage');
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function saveBufferToBlob(
  blobPath: string,
  file: UploadedFileData,
): Promise<string> {
  const uploadedBlob = new Blob([new Uint8Array(file.buffer)], {
    type: file.mimetype,
  });

  const { url } = await put(blobPath, uploadedBlob, {
    access: 'public',
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // Add cache-busting query parameter with current timestamp
  const cacheBuster = `?t=${Date.now()}`;
  return url + cacheBuster;
}

async function saveBufferToLocalFile(
  filePath: string,
  buffer: Buffer,
) {
  const directory = path.dirname(filePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  await fs.promises.writeFile(filePath, buffer);
}

async function compressImageToWebp(buffer: Buffer) {
  let compressedBuffer: Buffer | null = null;

  for (const step of IMAGE_COMPRESSION_STEPS) {
    compressedBuffer = await sharp(buffer)
      .rotate()
      .resize({
        width: step.width,
        height: step.width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: step.quality })
      .toBuffer();

    if (compressedBuffer.length <= MAX_IMAGE_SIZE_BYTES) {
      return compressedBuffer;
    }
  }

  if (!compressedBuffer) {
    throw new HttpException('Failed to compress image', HttpStatus.BAD_REQUEST);
  }

  if (compressedBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new HttpException('Unable to compress image below 1MB', HttpStatus.BAD_REQUEST);
  }

  return compressedBuffer;
}

async function prepareImageUpload(file: UploadedFileData) {
  const compressedBuffer = await compressImageToWebp(file.buffer);

  return {
    buffer: compressedBuffer,
    filenameExtension: '.webp',
    mimeType: 'image/webp',
  };
}

@Injectable()
export class UploadService {
  async saveImage(file: UploadedFileData, category: 'profile' | 'banner' | 'logo', uuid: string): Promise<string> {
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

      const preparedImage = await prepareImageUpload(file);
      const filename = `${uuid}${preparedImage.filenameExtension}`;

      if (hasBlobToken()) {
        return saveBufferToBlob(`img/${category}/${filename}`, {
          ...file,
          buffer: preparedImage.buffer,
          mimetype: preparedImage.mimeType,
          originalname: filename,
        });
      }

      const filePath = path.join(getStorageRoot(), 'img', category, filename);
      await saveBufferToLocalFile(filePath, preparedImage.buffer);
      return `/storage/img/${category}/${filename}`;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to save file', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async saveReviewMedia(file: UploadedFileData, uuid: string): Promise<{ url: string, type: 'IMAGE' | 'VIDEO' }> {
    try {
      if (!file) {
        throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
      }

      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];

      let type: 'IMAGE' | 'VIDEO';
      let categoryDir: string;
      let maxSize: number;

      if (allowedImageTypes.includes(file.mimetype)) {
        type = 'IMAGE';
        categoryDir = 'img';
        maxSize = 5 * 1024 * 1024; // 5MB
      } else if (allowedVideoTypes.includes(file.mimetype)) {
        type = 'VIDEO';
        categoryDir = 'video';
        maxSize = 50 * 1024 * 1024; // 50MB
      } else {
        throw new HttpException('Invalid file type. Only standard images and videos are allowed', HttpStatus.BAD_REQUEST);
      }

      if (file.size > maxSize) {
        throw new HttpException(`File size exceeds ${type === 'IMAGE' ? '5MB' : '50MB'} limit`, HttpStatus.BAD_REQUEST);
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const isImage = type === 'IMAGE';
      const preparedImage = isImage ? await prepareImageUpload(file) : null;
      const filename = `${uuid}-${uniqueSuffix}${isImage ? preparedImage!.filenameExtension : path.extname(file.originalname).toLowerCase()}`;

      if (hasBlobToken()) {
        const url = await saveBufferToBlob(`review/${categoryDir}/${filename}`, isImage ? {
          ...file,
          buffer: preparedImage!.buffer,
          mimetype: preparedImage!.mimeType,
          originalname: filename,
        } : file);
        return { url, type };
      }

      const filePath = path.join(getStorageRoot(), categoryDir, 'review', filename);
      await saveBufferToLocalFile(filePath, isImage ? preparedImage!.buffer : file.buffer);
      return { url: `/storage/${categoryDir}/review/${filename}`, type };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to save review media', error?.message || error),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
