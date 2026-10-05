import { AuthService } from './auth.service';
import { hashPassword, isPasswordHash } from './password';

describe('AuthService.validateUser', () => {
  let usersService;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByPhoneWithPassword: jest.fn(),
      setPasswordHash: jest.fn(),
    };
    service = new AuthService(usersService, {} as any);
  });

  it('looks the user up by phone only and compares the hash', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 1,
      phoneNumber: '380991112233',
      password: await hashPassword('secret123'),
    });

    const user = await service.validateUser('380991112233', 'secret123');

    expect(usersService.findByPhoneWithPassword).toHaveBeenCalledWith(
      '380991112233',
    );
    expect(user).toEqual({ id: 1, phoneNumber: '380991112233' });
    expect(usersService.setPasswordHash).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 1,
      password: await hashPassword('secret123'),
    });

    await expect(service.validateUser('380991112233', 'wrong-pass')).resolves.toBeNull();
  });

  it('rejects an unknown phone number', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue(null);

    await expect(service.validateUser('380991112233', 'secret123')).resolves.toBeNull();
  });

  it('replaces a legacy plain-text password with a hash on login', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 7,
      password: 'oldpass',
    });

    const user = await service.validateUser('380991112233', 'oldpass');

    expect(user).toEqual({ id: 7 });
    const [id, hash] = usersService.setPasswordHash.mock.calls[0];
    expect(id).toBe(7);
    expect(isPasswordHash(hash)).toBe(true);
  });

  it('does not touch a legacy password when it does not match', async () => {
    usersService.findByPhoneWithPassword.mockResolvedValue({
      id: 7,
      password: 'oldpass',
    });

    await expect(service.validateUser('380991112233', 'wrong-pass')).resolves.toBeNull();
    expect(usersService.setPasswordHash).not.toHaveBeenCalled();
  });
});
