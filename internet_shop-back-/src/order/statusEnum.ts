export enum Status {
  Processed = 'обробляється',
  Sent = 'відправлено',
  Received = 'отримано',
  Canceled = 'відмінено',
}

export const statusMessage = `Статус має бути одним із: ${Object.values(Status).join(', ')}`;
