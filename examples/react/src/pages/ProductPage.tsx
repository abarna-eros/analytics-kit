import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAnalytics } from '@analytics-kit/react-analytics/react';
import { getClarity } from '@analytics-kit/react-analytics/providers/clarity';
import type { AppEvents } from '../analytics';

export function ProductPage() {
  const analytics = useAnalytics<AppEvents>();
  const { id = '123' } = useParams();

  useEffect(() => {
    analytics.track('product_viewed', {
      productId: id,
      productName: 'Example Product',
      price: 499,
    });
  }, [analytics, id]);

  return (
    <section>
      <h1>Product {id}</h1>

      <button
        onClick={() => {
          analytics.track('checkout_started', { cartValue: 499, itemCount: 1 });

          // Provider-specific API: prioritise this session for Clarity recording.
          // Generic code never needs to know Clarity exists.
          getClarity(analytics)?.upgrade('checkout_started');
        }}
      >
        Start checkout
      </button>

      {/* Send an event to one provider only */}
      <button
        onClick={() =>
          analytics.track(
            'subscription_started',
            { plan: 'premium', price: 499 },
            { only: ['segment'] }
          )
        }
      >
        Segment-only event
      </button>
    </section>
  );
}
