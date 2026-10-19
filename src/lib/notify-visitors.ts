import { sendPushToVisitors, type PushPayload } from './push';

/**
 * Public-channel counterpart to `notifyOwners()` — a push to every anonymous
 * visitor who opted into a category, not to one specific person. Used for events
 * that are genuinely public: a listing going live, something landing on Hot Deals.
 *
 * Never throws: a broadcast failing should never take down the save that triggered
 * it (publishing a listing, flagging a hot deal), the same reasoning as push.ts
 * itself being non-throwing.
 */
export async function notifyVisitors(category: 'LISTINGS' | 'HOT_DEALS', payload: PushPayload): Promise<void> {
  try {
    await sendPushToVisitors(category, payload);
  } catch (error) {
    console.error('[notifyVisitors] push failed', error);
  }
}
