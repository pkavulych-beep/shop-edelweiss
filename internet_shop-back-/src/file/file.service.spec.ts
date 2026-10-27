import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { FileService, FileType } from './file.service';
import { getUploadsDir } from './uploads-dir';
import { IMAGE_FORMAT_ERROR, IMAGE_SIZE_ERROR, MAX_IMAGE_SIZE_BYTES } from './image';
import { THUMBNAIL_MAX_SIZE, thumbnailPath } from './thumbnail';

let PNG: Buffer;
let JPEG: Buffer;
let WEBP: Buffer;

const imageFile = (buffer: Buffer, mimetype: string, originalname: string) => ({
  buffer,
  mimetype,
  size: buffer.length,
  originalname,
});

describe('getUploadsDir', () => {
  const original = process.env.UPLOADS_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = original;
  });

  it('defaults to the uploads folder in the backend root, outside dist', () => {
    delete process.env.UPLOADS_DIR;

    expect(getUploadsDir()).toBe(path.resolve(__dirname, '..', '..', 'uploads'));
  });

  it('uses UPLOADS_DIR resolved to an absolute path', () => {
    process.env.UPLOADS_DIR = 'some/relative';

    expect(getUploadsDir()).toBe(path.resolve(process.cwd(), 'some/relative'));
  });
});

describe('FileService', () => {
  const original = process.env.UPLOADS_DIR;
  let uploadsDir: string;
  let service: FileService;

  beforeAll(async () => {
    PNG = await sharp({
      create: { width: 800, height: 1000, channels: 3, background: '#c0392b' },
    })
      .png()
      .toBuffer();
    JPEG = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#2c3e50' },
    })
      .jpeg()
      .toBuffer();
    WEBP = await sharp({
      create: { width: 640, height: 640, channels: 3, background: '#27ae60' },
    })
      .webp()
      .toBuffer();
  });

  beforeEach(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
    process.env.UPLOADS_DIR = uploadsDir;
    service = new FileService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    if (original === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = original;
  });

  it('writes the file into UPLOADS_DIR and returns its relative path', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(PNG, 'image/png', 'photo.png'),
    );

    expect(filePath.startsWith('image/')).toBe(true);
    expect(filePath).not.toContain('://');
    expect(filePath.endsWith('.png')).toBe(true);
    const saved = path.join(uploadsDir, filePath);
    expect(fs.readFileSync(saved)).toEqual(PNG);
  });

  it('creates a WebP thumbnail up to 600px on the longer side', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(PNG, 'image/png', 'photo.png'),
    );
    const thumbPath = path.join(uploadsDir, thumbnailPath(filePath));

    expect(thumbPath.endsWith('.thumb.webp')).toBe(true);
    expect(fs.existsSync(thumbPath)).toBe(true);

    const metadata = await sharp(thumbPath).metadata();
    expect(metadata.format).toBe('webp');
    expect(Math.max(metadata.width, metadata.height)).toBe(THUMBNAIL_MAX_SIZE);
    expect(fs.statSync(thumbPath).size).toBeLessThan(
      fs.statSync(path.join(uploadsDir, filePath)).size,
    );
  });

  it('does not enlarge a small thumbnail', async () => {
    const small = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .toBuffer();
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(small, 'image/jpeg', 'small.jpg'),
    );

    const metadata = await sharp(path.join(uploadsDir, thumbnailPath(filePath))).metadata();
    expect(metadata.width).toBe(200);
    expect(metadata.height).toBe(100);
  });

  it('deletes a previously created file from UPLOADS_DIR', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(JPEG, 'image/jpeg', 'photo.jpg'),
    );

    await service.deleteFile(filePath);

    expect(fs.existsSync(path.join(uploadsDir, filePath))).toBe(false);
  });

  it('deletes the original together with its thumbnail', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(JPEG, 'image/jpeg', 'photo.jpg'),
    );

    await service.deleteImage(filePath);

    expect(fs.existsSync(path.join(uploadsDir, filePath))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, thumbnailPath(filePath)))).toBe(false);
  });

  it('deletes an original that has no thumbnail yet', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(JPEG, 'image/jpeg', 'photo.jpg'),
    );
    fs.rmSync(path.join(uploadsDir, thumbnailPath(filePath)));

    await expect(service.deleteImage(filePath)).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(uploadsDir, filePath))).toBe(false);
  });

  it('deletes a legacy file saved with a full URL', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(JPEG, 'image/jpeg', 'old.jpg'),
    );

    await service.deleteFile('http://localhost:7777/' + filePath);

    expect(fs.existsSync(path.join(uploadsDir, filePath))).toBe(false);
  });

  it('rejects a path that escapes UPLOADS_DIR', async () => {
    const outside = path.join(uploadsDir, '..', 'outside.png');
    fs.writeFileSync(outside, PNG);

    try {
      const promise = service.deleteFile('../outside.png');

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      expect(fs.existsSync(outside)).toBe(true);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('deleteFile returns 404 with generic message for non-existent file (no server paths)', async () => {
    const promise = service.deleteFile('image/nonexistent.jpg');

    await expect(promise).rejects.toThrow(HttpException);

    const e = await promise.catch((err) => err);
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
    const response = e.getResponse();
    expect(typeof response).toBe('string');
    expect(response).toBe('Файл не знайдено');
    expect(response).not.toContain('/');
    expect(response).not.toMatch(/[A-Za-z]:\\/);
  });

  it('createFile returns 500 with generic message on error (no server paths)', async () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied, open \'/srv/secret/path/image/photo.png\'');
    });

    const caught = await service
      .createFile(FileType.IMAGE, imageFile(PNG, 'image/png', 'photo.png'))
      .catch((err) => err);

    expect(caught).toBeInstanceOf(HttpException);
    expect(caught.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const response = caught.getResponse();
    expect(typeof response).toBe('string');
    expect(response).toBe('Не вдалося створити файл');
    expect(response).not.toContain('/');
    expect(response).not.toMatch(/[A-Za-z]:\\/);
    expect(response).not.toContain('secret');
    expect(response).not.toContain('srv');
  });

  it('does not keep the original when the thumbnail cannot be generated', async () => {
    const brokenWebp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x1a, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 '),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
    ]);

    const caught = await service
      .createFile(FileType.IMAGE, imageFile(brokenWebp, 'image/webp', 'photo.webp'))
      .catch((err) => err);

    expect(caught).toBeInstanceOf(HttpException);
    expect(fs.readdirSync(path.join(uploadsDir, 'image'))).toEqual([]);
  });

  it('deleteFile returns 500 with generic message on filesystem error (no server paths)', async () => {
    const filePath = await service.createFile(
      FileType.IMAGE,
      imageFile(JPEG, 'image/jpeg', 'photo-perm.jpg'),
    );

    const errorWithPath = new Error(
      "EACCES: permission denied, unlink '/srv/secret/path/image/photo-perm.jpg'",
    );
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw errorWithPath;
    });

    await expect(service.deleteFile(filePath)).rejects.toThrow(HttpException);

    const e = await service.deleteFile(filePath).catch((err) => err);
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const response = e.getResponse();
    expect(typeof response).toBe('string');
    expect(response).toBe('Не вдалося видалити файл');
    expect(response).not.toContain('/');
    expect(response).not.toMatch(/[A-Za-z]:\\/);
    expect(response).not.toContain('secret');
    expect(response).not.toContain('srv');
  });

  describe('image validation', () => {
    const expectBadRequest = async (file, message: string) => {
      const caught = await service.createFile(FileType.IMAGE, file).catch((err) => err);

      expect(caught).toBeInstanceOf(BadRequestException);
      expect(caught.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(caught.message).toBe(message);
    };

    it('rejects a non-image mime type', async () => {
      const html = Buffer.from('<html><script>alert(1)</script></html>');

      await expectBadRequest(imageFile(html, 'text/html', 'photo.html'), IMAGE_FORMAT_ERROR);
    });

    it('rejects html renamed to png by checking the file signature', async () => {
      const html = Buffer.from('<html><script>alert(1)</script></html>');

      await expectBadRequest(imageFile(html, 'image/png', 'photo.png'), IMAGE_FORMAT_ERROR);
    });

    it('rejects an image whose content does not match its mime type', async () => {
      await expectBadRequest(imageFile(JPEG, 'image/png', 'photo.png'), IMAGE_FORMAT_ERROR);
    });

    it('takes the extension from the type, not the uploaded file name', async () => {
      const filePath = await service.createFile(
        FileType.IMAGE,
        imageFile(PNG, 'image/png', 'photo.html'),
      );

      expect(filePath.endsWith('.png')).toBe(true);
      expect(fs.existsSync(path.join(uploadsDir, filePath))).toBe(true);
    });

    it('accepts webp photos', async () => {
      const filePath = await service.createFile(
        FileType.IMAGE,
        imageFile(WEBP, 'image/webp', 'photo.bin'),
      );

      expect(filePath.endsWith('.webp')).toBe(true);
      expect(fs.existsSync(path.join(uploadsDir, thumbnailPath(filePath)))).toBe(true);
    });

    it('rejects a photo larger than 10 MB', async () => {
      const oversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);
      PNG.copy(oversized);

      await expectBadRequest(imageFile(oversized, 'image/png', 'photo.png'), IMAGE_SIZE_ERROR);
    });
  });
});
