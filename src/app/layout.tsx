import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "OwnLine — your internet account, your keys",
  description: "A privacy-first ISP portal: customers control which account and usage details their provider can read. Powered by Tide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
