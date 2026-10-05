interface IRegisterUserDto {
  fullName: string;
  email?: string;
  password: string;
  phoneNumber: string;
  basketId?: number;
}

export type UpdateUserData = Pick<
  IRegisterUserDto,
  'fullName' | 'phoneNumber' | 'email'
>;

export const userApi = instance => ({
  async register(dto: IRegisterUserDto) {
    const { data } = await instance.post('/users', dto);
    return data;
  },

  async getUsers() {
    const { data } = await instance.get('/users');
    return data;
  },

  async update(id: number, dto: UpdateUserData) {
    const { data } = await instance.patch(`/users/${id}`, dto);
    return data;
  },

  async cleanTheBasket(idUser) {
    const { data } = await instance.delete(`/users/basket/${idUser}`);
    return data;
  },
});
