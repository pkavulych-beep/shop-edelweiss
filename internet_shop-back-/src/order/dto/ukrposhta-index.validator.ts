import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DeliveryMethod, ukrposhtaIndexMessage } from '../deliveryEnum';

// Для Укрпошти у department — поштовий індекс відділення (рівно 5 цифр),
// для Нової пошти і Meest — довільна назва відділення від перевізника
@ValidatorConstraint({ name: 'IsUkrposhtaIndex', async: false })
export class IsUkrposhtaIndexConstraint implements ValidatorConstraintInterface {
  validate(department: unknown, args: ValidationArguments) {
    const { deliveryMethod } = args.object as { deliveryMethod?: DeliveryMethod };
    if (deliveryMethod !== DeliveryMethod.Ukrposhta) {
      return true;
    }
    return typeof department === 'string' && /^\d{5}$/.test(department);
  }

  defaultMessage() {
    return ukrposhtaIndexMessage;
  }
}
