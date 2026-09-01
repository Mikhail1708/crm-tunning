import { canTransitionOrderStatus } from './orderStateMachine';

export type OrderCancellationDecision = {
  decision: 'accepted' | 'rejected';
  reasonCode: string;
};

export const decideOrderCancellation = (currentStatus: string): OrderCancellationDecision => {
  if (currentStatus === 'cancelled') {
    return { decision: 'accepted', reasonCode: 'ALREADY_CANCELLED' };
  }
  if (canTransitionOrderStatus(currentStatus, 'cancelled')) {
    return { decision: 'accepted', reasonCode: 'CANCELLATION_ACCEPTED' };
  }
  if (currentStatus === 'shipped') {
    return { decision: 'rejected', reasonCode: 'FULFILLMENT_ALREADY_SHIPPED' };
  }
  return { decision: 'rejected', reasonCode: 'CANCELLATION_NOT_ALLOWED' };
};

