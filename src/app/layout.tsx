import type { Metadata, Viewport } from "next";
import "./styles.scss";

export const metadata: Metadata = {
  title: "QuickList, for Jobber",
  description: "The fastest way to view a list of Jobber Visits.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  userScalable: false,
  maximumScale: 1.0
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700;800&display=swap" rel="stylesheet" />
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
