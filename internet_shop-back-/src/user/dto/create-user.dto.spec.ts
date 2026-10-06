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
    ['without full name', { fullName: undefined }],
    ['without phone', { phoneNumber: undefined }],
    ['without password', { password: undefined }],
    ['with a short password', { password: '123' }],
  ])('rejects a registration %s', async (_name, patch) => {
    await expect(validate({ ...valid, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
