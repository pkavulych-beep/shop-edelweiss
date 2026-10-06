// Канонічний вигляд номера в базі: 380XXXXXXXXX — ті самі цифри, що й
// у записі +380XXXXXXXXX. Так само зберігаються номери вже наявних
// користувачів і в заявках «замовити в 1 клік», тому «+» не додаємо.
export const UA_PHONE_PATTERN = /^380\d{9}$/;

export const UA_PHONE_MESSAGE =
  'Вкажіть український номер телефону у форматі +38 (0XX) XXX-XX-XX';

// "099 123 45 67", "+38 (099) 123-45-67", "0991234567", "991234567"
// і "380991234567" → "380991234567". Рядки, які не вдається звести до
// українського номера, повертаються як є — їх відсіє UA_PHONE_PATTERN.
export const normalizePhone = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  const core = digits.startsWith('380')
    ? digits.slice(3)
    : digits.startsWith('0')
    ? digits.slice(1)
    : digits;
  return `380${core}`;
};
