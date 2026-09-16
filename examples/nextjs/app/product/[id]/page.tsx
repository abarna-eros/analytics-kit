import { ProductTracking } from './ProductTracking';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <section>
      <h1>Product {id}</h1>
      {/* Product data is fetched on the server; only the id crosses into the
          client component that tracks the view. */}
      <ProductTracking productId={id} productName="Example Product" price={499} />
    </section>
  );
}
