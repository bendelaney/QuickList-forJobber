export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
  const weekday = weekdayFormatter.format(date)
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' })
  let formattedDate = dateFormatter.format(date)
  formattedDate = formattedDate.replace(/(\d)(:?\d{2})\s?([AaPp][Mm])/, '$1$2$3').toLowerCase()
  return `${weekday} ${formattedDate}`
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return timeFormatter.format(date)
}

