import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { baseUrl, FileService, FileType } from './file.service';
import { getUploadsDir } from './uploads-dir';

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

  it('writes the file into UPLOADS_DIR and returns its public url', () => {
    const url = service.createFile(FileType.IMAGE, {
      originalname: 'photo.png',
      buffer: Buffer.from('png'),
    });

    expect(url.startsWith(baseUrl + 'image/')).toBe(true);
    expect(url.endsWith('.png')).toBe(true);
    const saved = path.join(uploadsDir, url.replace(baseUrl, ''));
    expect(fs.readFileSync(saved, 'utf8')).toBe('png');
  });

  it('deletes a previously created file from UPLOADS_DIR', async () => {
    const url = service.createFile(FileType.IMAGE, {
      originalname: 'photo.jpg',
      buffer: Buffer.from('jpg'),
    });

    await service.deleteFile(url);

    expect(fs.existsSync(path.join(uploadsDir, url.replace(baseUrl, '')))).toBe(false);
  });

  it('deleteFile returns 404 with generic message for non-existent file (no server paths)', async () => {
    const promise = service.deleteFile(baseUrl + 'image/nonexistent.jpg');

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

  it('createFile returns 500 with generic message on error (no server paths)', () => {
    const invalidFile = { originalname: 'test', buffer: null };

    expect(() => service.createFile(FileType.IMAGE, invalidFile)).toThrow(HttpException);

    let caught: HttpException | null = null;
    try {
      service.createFile(FileType.IMAGE, invalidFile);
    } catch (e) {
      caught = e as HttpException;
    }
    expect(caught).not.toBeNull();
    expect(caught!.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const response = caught!.getResponse();
    expect(typeof response).toBe('string');
    expect(response).toBe('Не вдалося створити файл');
    expect(response).not.toContain('/');
    expect(response).not.toMatch(/[A-Za-z]:\\/);
  });

  it('deleteFile returns 500 with generic message on filesystem error (no server paths)', async () => {
    const url = service.createFile(FileType.IMAGE, {
      originalname: 'photo-perm.jpg',
      buffer: Buffer.from('jpg-perm'),
    });

    const errorWithPath = new Error('EACCES: permission denied, unlink \'/srv/secret/path/image/photo-perm.jpg\'');
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
      throw errorWithPath;
    });

    await expect(service.deleteFile(url)).rejects.toThrow(HttpException);

    const e = await service.deleteFile(url).catch((err) => err);
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
});
