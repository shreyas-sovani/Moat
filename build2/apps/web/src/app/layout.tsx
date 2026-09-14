import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
	title: "Moat",
	description: "Liquidation protection that plans with AI and executes without it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
