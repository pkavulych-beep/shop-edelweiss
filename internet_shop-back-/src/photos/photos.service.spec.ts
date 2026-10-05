import { PhotosService } from './photos.service';

describe('PhotosService', () => {
  let repository;
  let service: PhotosService;

  beforeEach(() => {
    repository = { delete: jest.fn() };
    service = new PhotosService(repository);
  });

  describe('remove', () => {
    it('waits for the deletion and returns its result', async () => {
      const result = { raw: [], affected: 1 };
      repository.delete.mockResolvedValue(result);

      await expect(service.remove(3)).resolves.toBe(result);
      expect(repository.delete).toHaveBeenCalledWith(3);
    });

    it('propagates repository errors', async () => {
      repository.delete.mockRejectedValue(new Error('db down'));

      await expect(service.remove(3)).rejects.toThrow('db down');
    });
  });
});
