import AuthLoading from "@/components/AuthLoading"

type SearchParams = {
  state?: "checking" | "redirecting" | "loading"
  message?: string
}

export default async function AuthPreview({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const state = params.state ?? "loading"
  const message = params.message

  return <AuthLoading state={state} message={message} />
}

