import { GetServerSideProps, NextPage } from 'next';

// Старі посилання на /payment/fail не мають давати 404:
// mono завжди повертає на /payment/success, тож просто переадресовуємо.
export const getServerSideProps: GetServerSideProps = async (context) => {
  const rawOrderId = context.query.orderId;
  const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
  const destination = orderId
    ? `/payment/success?orderId=${encodeURIComponent(orderId)}`
    : '/payment/success';
  return { redirect: { destination, permanent: false } };
};

const PaymentFail: NextPage = () => null;

export default PaymentFail;
