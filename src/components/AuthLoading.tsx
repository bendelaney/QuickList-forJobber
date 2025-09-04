"use client"

import React from "react"
import QuickListLogo from "./QuickListLogo"

type AuthState = "checking" | "redirecting" | "loading"

interface Props {
  state?: AuthState
  message?: string
}

export default function AuthLoading({ state = "loading", message }: Props) {
  const defaultMessage =
    message ||
    (state === "redirecting"
      ? "Redirecting to Jobber…"
      : state === "checking"
      ? "Checking your session…"
      : "Loading…")

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-text">
            <h1 aria-label="QuickList, for Jobber">
              <QuickListLogo />
              <span>for Jobber</span>
            </h1>
          </div>
        </div>
        <div className="auth-status">
          <div className="spinner" aria-label="Loading" />
          <p>{defaultMessage}</p>
          {state === "redirecting" && (
            <small>just another moment…</small>
          )}
        </div>
      </div>
    </div>
  )
}

