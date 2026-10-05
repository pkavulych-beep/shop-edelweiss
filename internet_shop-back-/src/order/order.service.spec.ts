import { NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';

describe('OrderService', () => {
  it('does not create an order with a hidden product', async () => {
    const repository = { save: jest.fn() };
    const productService = {
      assertPurchasable: jest.fn().mockRejectedValue(new NotFoundException()),
    };
    const userService = { findOne: jest.fn() };
    const service = new OrderService(repository as any, productService as any, userService as any);

    await expect(
      service.create({
        userId: 1,
        productId: [1, 5],
        comment: '',
        cityName: 'Київ',
        department: '1',
        size: 'M',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(productService.assertPurchasable).toHaveBeenCalledWith([1, 5]);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
