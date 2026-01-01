import LandingPage from './landing/page';

export default function RootPage() {
  // Show landing page for all users (logged-in users will see "Dashboard" button)
  return <LandingPage />;
}
