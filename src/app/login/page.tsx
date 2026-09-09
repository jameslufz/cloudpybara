"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./login.module.css";
import logoImage from "./cloudpybara-logo.png";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        await submitLogin();
    }

    // Some browsers/extensions swallow the native Enter-submits-the-form
    // behavior (e.g. an autofill suggestion popup consuming the keydown),
    // so handle Enter explicitly on each field instead of relying on it.
    function handleFieldKeyDown(event: React.KeyboardEvent) {
        if (event.key !== "Enter") {
            return;
        }
        event.preventDefault();
        submitLogin();
    }

    async function submitLogin() {
        if (isSubmitting) {
            return;
        }
        setErrorMessage("");
        setIsSubmitting(true);

        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const data = await response.json();
            setErrorMessage(data.error ?? "Login failed.");
            setIsSubmitting(false);
            return;
        }

        router.push("/");
        router.refresh();
    }

    return (
        <div className={styles.page}>
            <form className={styles.card} onSubmit={handleSubmit}>
                <h1 className={styles.srOnly}>CloudPybara</h1>
                <Image
                    src={logoImage}
                    alt="CloudPybara"
                    className={styles.logo}
                    priority
                />
                <p className={styles.subtitle}>Store your data as a capybara.</p>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Username</span>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        autoComplete="username"
                        placeholder="Username"
                        autoFocus
                        required
                    />
                </label>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                        autoComplete="current-password"
                        placeholder="Password"
                        required
                    />
                </label>

                {errorMessage && <p className={styles.error}>{errorMessage}</p>}

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </div>
    );
}
