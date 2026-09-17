import { Outlet } from 'react-router-dom';
import { Footer } from '../components/docs/Footer';
import { Header } from '../components/docs/Header';

export function SiteLayout() {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Header />
      <main id="content">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
