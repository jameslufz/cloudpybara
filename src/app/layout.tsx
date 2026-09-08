import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "CloudPybara",
    description: "Browse and upload files stored on your phone",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    // Lets the page draw under the notch/home-indicator area so the
    // safe-area-inset-* CSS vars below actually have something to pad.
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
        { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
    ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
