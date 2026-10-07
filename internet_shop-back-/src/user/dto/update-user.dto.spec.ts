import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: UpdateUserDto });

  const valid = {
    fullName: 'Іваненко Іван Іванович',
    phoneNumber: '380991112233',
  };

  const messageOf = async (body: object) => {
    const response = await validate(body).catch((e: BadRequestException) =>
      e.getResponse(),
    );
    return (response as { message: string[] }).message;
  };

  it('accepts the profile data unchanged', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it.each([
    ['380991112233', '380991112233'],
    ['+380991112233', '380991112233'],
    ['099 111 22 33', '380991112233'],
    ['991112233', '380991112233'],
  ])('normalizes the phone %s to 380991112233', async (phoneNumber, phone) => {
    await expect(validate({ ...valid, phoneNumber })).resolves.toEqual({
      ...valid,
      phoneNumber: phone,
    });
  });

  it('reports an unusable phone in Ukrainian', async () => {
    await expect(messageOf({ ...valid, phoneNumber: '12' })).resolves.toEqual([
      'Вкажіть український номер телефону у форматі +38 (0XX) XXX-XX-XX',
    ]);
  });

  it.each([
    ['without full name', { fullName: undefined }],
    ['without phone', { phoneNumber: undefined }],
    ['with an empty phone', { phoneNumber: '' }],
    ['with a too long phone', { phoneNumber: '3809911122334' }],
    ['with a non-Ukrainian phone', { phoneNumber: '+48 501 234 567' }],
    ['with a non-string phone', { phoneNumber: 380991112233 }],
  ])('rejects a profile update %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
