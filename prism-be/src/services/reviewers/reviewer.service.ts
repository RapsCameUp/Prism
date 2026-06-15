const REVIEWER_MAP: Record<string, string[]> = {
  'checkout-service': ['Sarah Chen', 'Michael Jacobs'],
  'payment-service': ['Priya Patel', 'Sarah Chen'],
  'auth-service': ['Michael Jacobs', 'James Wilson'],
  'notification-service': ['Priya Patel', 'Emily Rodriguez'],
  'inventory-service': ['James Wilson', 'Sarah Chen'],
  default: ['Sarah Chen', 'Michael Jacobs', 'Priya Patel'],
};

export function assignReviewers(serviceName: string): string[] {
  return REVIEWER_MAP[serviceName] || REVIEWER_MAP['default'];
}
