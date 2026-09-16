'use client';

import { useEffect } from 'react';
import { useAnalytics } from 'analytics-bridge/next';
import { getClarity } from 'analytics-bridge/providers/clarity';
import type { AppEvents } from '../../analytics';

interface ProductTrackingProps {
  productId: string;
  productName: string;
  price: number;
}

export function ProductTracking({ productId, productName, price }: ProductTrackingProps) {
  const analytics = useAnalytics<AppEvents>();

  useEffect(() => {
    analytics.track('product_viewed', { productId, productName, price });
  }, [analytics, productId, productName, price]);

  return (
    <button
      onClick={() => {
        analytics.track('checkout_started', { cartValue: price, itemCount: 1 });

        // Provider-specific escape hatch, typed and tree-shakable.
        getClarity(analytics)?.upgrade('checkout_started');
      }}
    >
      Start checkout
    </button>
  );
}
