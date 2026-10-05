import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
});
