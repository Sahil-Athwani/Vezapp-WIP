import './globals.css';

export const metadata = {
  title: 'Vezapp-WIP',
  description: 'Voice-driven Pattern Master, Mould Reporting and WIP entry',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
