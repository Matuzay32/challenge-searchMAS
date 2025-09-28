import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/httpError.js';

export interface UploadedFile {
  fieldName: string;
  originalName: string;
  buffer: Buffer;
  mimetype: string;
}

export interface RequestWithFile extends Request {
  file?: UploadedFile;
}

function extractBoundary(contentType: string | undefined): string | null {
  if (!contentType) {
    return null;
  }

  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    return null;
  }

  return `--${match[1] ?? match[2]}`;
}

function parseMultipart(buffer: Buffer, boundary: string, fieldName: string): UploadedFile | null {
  const raw = buffer.toString('latin1');
  const sections = raw.split(boundary);

  for (const section of sections) {
    if (!section || section === '--' || section === '--\r\n') {
      continue;
    }

    const cleanedSection = section.replace(/^\r\n/, '');
    if (!cleanedSection || cleanedSection === '--') {
      continue;
    }

    const headerEndIndex = cleanedSection.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
      continue;
    }

    const headerBlock = cleanedSection.slice(0, headerEndIndex);
    const bodyBlock = cleanedSection.slice(headerEndIndex + 4);

    const headers = headerBlock.split('\r\n').map((line) => line.trim());
    const dispositionHeader = headers.find((line) => line.toLowerCase().startsWith('content-disposition'));
    if (!dispositionHeader) {
      continue;
    }

    const nameMatch = dispositionHeader.match(/name="([^\"]+)"/i);
    if (!nameMatch || nameMatch[1] !== fieldName) {
      continue;
    }

    const filenameMatch = dispositionHeader.match(/filename="([^\"]*)"/i);
    if (!filenameMatch || !filenameMatch[1]) {
      throw new AppError(400, 'No file provided in form-data payload');
    }

    const contentTypeHeader = headers.find((line) => line.toLowerCase().startsWith('content-type'));
    const mimetype = contentTypeHeader ? contentTypeHeader.split(':')[1].trim() : 'application/octet-stream';

    const trimmedBody = bodyBlock.replace(/\r\n$/, '');
    const fileBuffer = Buffer.from(trimmedBody, 'latin1');

    return {
      fieldName,
      originalName: filenameMatch[1],
      buffer: fileBuffer,
      mimetype,
    };
  }

  return null;
}

export function singleFileUpload(fieldName: string) {
  return (req: RequestWithFile, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
      next(new AppError(400, 'Content-Type must be multipart/form-data'));
      return;
    }

    const boundary = extractBoundary(contentType);
    if (!boundary) {
      next(new AppError(400, 'Invalid multipart payload: missing boundary'));
      return;
    }

    const chunks: Buffer[] = [];
    let finished = false;

    const complete = (err?: unknown) => {
      if (finished) {
        return;
      }
      finished = true;
      if (err) {
        next(err as Error);
      } else {
        next();
      }
    };

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.once('error', (error) => {
      complete(error);
    });

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const file = parseMultipart(buffer, boundary, fieldName);
        if (!file) {
          complete(new AppError(400, `Field ${fieldName} was not found in form-data payload`));
          return;
        }

        req.file = file;
        complete();
      } catch (error) {
        complete(error);
      }
    });
  };
}
