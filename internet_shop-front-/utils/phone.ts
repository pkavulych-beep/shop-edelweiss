// Номер телефону: маска введення та нормалізація до канонічного вигляду
// 380XXXXXXXXX (ті самі цифри, що й у +380XXXXXXXXX — з нього прибрано «+»,
// бо такий запис уже зберігається в базі).

export const PHONE_MASK = '+38 (0';

export const PHONE_MESSAGE =
  'Вкажіть український номер телефону у форматі +38 (0XX) XXX-XX-XX';

// "067 123 45 67", "+380671234567", "991234567" → "380671234567",
// інакше null — номер не схожий на український
export const normalizePhone = (value: string): string | null => {
  const digits = String(value ?? '').replace(/\D/g, '');
  const core = digits.startsWith('380')
    ? digits.slice(3)
    : digits.startsWith('0')
    ? digits.slice(1)
    : digits;
  const phone = `380${core}`;
  return /^380\d{9}$/.test(phone) ? phone : null;
};

const digitsOf = (value: string): string => value.replace(/\D/g, '');

// Користувач може ввести номер як «380671234567», «0671234567» або одразу
// з кодом оператора — прибираємо те, що вже дає префікс маски
const stripPrefixes = (digits: string): string => {
  let core = digits;
  for (let i = 0; i < 2 && /^(380|0)/.test(core); i += 1) {
    core = core.replace(/^(380|0)/, '');
  }
  return core;
};

const coreOf = (value: string): string => {
  const isMasked = value.startsWith(PHONE_MASK);
  return stripPrefixes(
    isMasked ? digitsOf(value.slice(PHONE_MASK.length)) : digitsOf(value),
  );
};

// Показує номер у вигляді "+38 (0XX) XXX-XX-XX", додаючи символи по мірі
// набору. previous — попереднє значення поля: без нього Backspace, що
// потрапив на роздільник, не прибрав би цифру.
export const maskPhoneInput = (value: string, previous = ''): string => {
  const isMasked = value.startsWith(PHONE_MASK);
  let core = stripPrefixes(
    isMasked ? digitsOf(value.slice(PHONE_MASK.length)) : digitsOf(value),
  );

  // Завеликий номер не калічимо: нехай лишається, як його ввели, і валідація
  // покаже помилку на введеному тексті
  if (core.length > 9) return value;

  if (
    previous &&
    value.length < previous.length &&
    previous.startsWith(value) &&
    core.length >= coreOf(previous).length
  ) {
    core = core.slice(0, -1);
  }

  if (!core) return '';

  let masked = `${PHONE_MASK}${core.slice(0, 2)}`;
  if (core.length > 2) masked += `) ${core.slice(2, 5)}`;
  if (core.length > 5) masked += `-${core.slice(5, 7)}`;
  if (core.length > 7) masked += `-${core.slice(7, 9)}`;
  return masked;
};

// "380991112233" → "+38 (099) 111-22-33"
export const formatPhone = (phone: string): string => maskPhoneInput(phone);
