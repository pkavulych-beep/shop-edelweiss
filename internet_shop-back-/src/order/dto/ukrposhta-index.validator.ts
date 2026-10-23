import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DeliveryMethod, ukrposhtaIndexMessage } from '../deliveryEnum';
import { getRepository, getConnection } from 'typeorm';
import { OrderEntity } from '../entities/order.entity';

// Для Укрпошти у department — поштовий індекс відділення (рівно 5 цифр),
// для Нової пошти і Meest — довільна назва відділення від перевізника
@ValidatorConstraint({ name: 'IsUkrposhtaIndex', async: true })
export class IsUkrposhtaIndexConstraint implements ValidatorConstraintInterface {
  async validate(department: unknown, args: ValidationArguments) {
    const object = args.object as { deliveryMethod?: DeliveryMethod; id?: number };
    let deliveryMethod = object.deliveryMethod;

    const tryGetRepository = () => {
      try {
        return getRepository(OrderEntity);
      } catch (e) {
        try {
          const conn = getConnection();
          return conn.getRepository(OrderEntity);
        } catch (e2) {
          return null;
        }
      }
    };

    // If deliveryMethod not provided in update, get it from existing order
    if (!deliveryMethod && object.id) {
      try {
        const repo = tryGetRepository();
        if (repo) {
          const order = await repo.findOne({ where: { id: object.id } });
          if (order) {
            deliveryMethod = order.deliveryMethod;
          }
        }
      } catch (e) {
        // If can't load order, fall back to body check
      }
    }

    if (deliveryMethod !== DeliveryMethod.Ukrposhta) {
      return true;
    }

    // If department not provided in update but will remain from existing order
    // and existing order uses Ukrposhta, we need to check existing department
    if (department === undefined && object.id) {
      try {
        const repo = tryGetRepository();
        if (repo) {
          const order = await repo.findOne({ where: { id: object.id } });
          if (order && order.deliveryMethod === DeliveryMethod.Ukrposhta) {
            department = order.department;
          }
        }
      } catch (e) {
        // fall through
      }
    }

    return typeof department === 'string' && /^\d{5}$/.test(department);
  }

  defaultMessage() {
    return ukrposhtaIndexMessage;
  }
}
