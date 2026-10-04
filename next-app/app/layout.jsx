import '../styles/code-window.css';
import '../styles/loading.css';
import '../styles/layout.css';
import '../styles/theme.css';
import '../styles/theme-modes.css';
import '../styles/editorial.css';

export const metadata = {
  title: 'SDKSPACE · Get Started',
  description: 'Reusable SDK examples for chat, code, images, and research. Define a task, follow the steps, and review the result.',
  icons: { icon: '/logo.svg' },
};
export const viewport = { themeColor: '#000000' };

export default function RootLayout({ children }) {
  return <html lang="en" suppressHydrationWarning><body className="sdk-layout sdk-standard">{children}</body></html>;
}
