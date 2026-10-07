import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validate = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: CreateUserDto });

  const valid = {
    fullName: 'Іваненко Іван Іванович',
    phoneNumber: '380991112233',
    password: 'secret123',
  };

  const messageOf = async (body: object) => {
    const response = await validate(body).catch((e: BadRequestException) =>
      e.getResponse(),
    );
    return (response as { message: string[] }).message;
  };

  it('registers a user without an email', async () => {
    await expect(validate(valid)).resolves.toEqual(valid);
  });

  it.each([
    ['an empty email', ''],
    ['a whitespace-only email', '   '],
  ])('ignores %s', async (_name, email) => {
    await expect(validate({ ...valid, email })).resolves.toEqual(valid);
  });

  it('keeps a valid email', async () => {
    const email = 'ivan@example.com';
    await expect(validate({ ...valid, email })).resolves.toEqual({
      ...valid,
      email,
    });
  });

  it('trims an email', async () => {
    await expect(
      validate({ ...valid, email: ' ivan@example.com ' }),
    ).resolves.toEqual({ ...valid, email: 'ivan@example.com' });
  });

  it('rejects a malformed email in Ukrainian', async () => {
    await expect(
      messageOf({ ...valid, email: 'ivan@' }),
    ).resolves.toEqual(['Некоректна адреса електронної пошти']);
  });

  it.each([
    ['380991112233', '380991112233'],
    ['+380991112233', '380991112233'],
    ['+38 (099) 111-22-33', '380991112233'],
    ['099 111 22 33', '380991112233'],
    ['0991112233', '380991112233'],
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
    ['with a short phone', { phoneNumber: '12' }],
    ['with a too long phone', { phoneNumber: '3809911122334' }],
    ['with a non-Ukrainian phone', { phoneNumber: '+48 501 234 567' }],
    ['with a non-string phone', { phoneNumber: 380991112233 }],
    ['without password', { password: undefined }],
    ['with a short password', { password: '123' }],
  ])('rejects a registration %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
