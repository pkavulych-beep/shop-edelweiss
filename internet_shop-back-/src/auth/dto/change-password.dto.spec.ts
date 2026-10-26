import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: ChangePasswordDto });

  const valid = {
    currentPassword: 'oldpass123',
    newPassword: 'newpass123',
  };

  it('accepts a valid password change', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it.each([
    ['without current password', { currentPassword: undefined }],
    ['with an empty current password', { currentPassword: '' }],
    ['without new password', { newPassword: undefined }],
    ['with a short new password', { newPassword: '12345' }],
    ['with a too long new password', { newPassword: 'a'.repeat(33) }],
  ])('rejects a request %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
