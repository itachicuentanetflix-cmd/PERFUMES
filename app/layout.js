import './globals.css';

export const metadata = { title: 'PERFUMES JEAN', description: 'Control de importaciones, lotes, costos y ventas de perfumes' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body>{children}</body>
    </html>
  );
}
