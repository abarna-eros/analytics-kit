import { TrackingButtons } from './TrackingButtons';

// A Server Component: it renders on the server and ships no analytics code.
// Interactivity lives in the small client component below it.
export default function HomePage() {
  return (
    <section>
      <h1>Home</h1>
      <p>This page is server-rendered. The buttons below are a client component.</p>
      <TrackingButtons />
    </section>
  );
}
