import AuthLoading from "@/components/AuthLoading"

type SearchParams = {
  state?: "checking" | "redirecting" | "loading"
  message?: string
}

export default function AuthPreview({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const state = searchParams.state ?? "loading"
  const message = searchParams.message

  return <AuthLoading state={state} message={message} />
}

