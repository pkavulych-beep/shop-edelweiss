export const CARD_PAYMENT_UNAVAILABLE = 'Оплата карткою зараз недоступна';

// Онлайн-оплата працює лише коли налаштований еквайринг mono і є обидві
// адреси: BASE_URL для вебхука та FRONTEND_URL для повернення покупця.
// Сам токен назовні не віддаємо — лише цей булевий прапорець.
export function isCardPaymentAvailable(): boolean {
  return Boolean(
    process.env.MONO_ACQUIRING_TOKEN &&
      process.env.BASE_URL &&
      process.env.FRONTEND_URL,
  );
}
