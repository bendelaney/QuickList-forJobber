'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
declare global {
  interface Window {
    flatpickr: any;
    marked: any;
  }
}

interface Settings {
  sortBy: string
  annual: string
  showDates: boolean
  dateDisplayType: string
  showValue: boolean
  showSalesperson: boolean
  showRangeInfo: boolean
  showTime: boolean
  startDate: string | null
  endDate: string | null
  salespersonFilter: string
  selectedSalespeople: string[]
  dayFilter: string
  selectedDays: string[]
  expandedSections: {
    display: boolean
    sorting: boolean
    visibility: boolean
  }
}

const DEFAULT_SETTINGS: Settings = {
  sortBy: "date",
  annual: "include",
  showDates: false,
  dateDisplayType: "all",
  showValue: false,
  showSalesperson: true,
  showRangeInfo: true,
  showTime: false,
  startDate: null,
  endDate: null,
  salespersonFilter: "all",
  selectedSalespeople: [],
  dayFilter: "all",
  selectedDays: [],
  expandedSections: {
    display: true,
    sorting: true,
    visibility: true
  }
}


// HELPER FUNCTIONS
// Helper function to format a date string into a friendly format.
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  const weekday = weekdayFormatter.format(date);
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' });
  let formattedDate = dateFormatter.format(date);
  formattedDate = formattedDate.replace(/(\d)(:?\d{2})\s?([AaPp][Mm])/, '$1$2$3').toLowerCase();
  return `${weekday} ${formattedDate}`;
}

// Helper function to format a time string from a date
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const timeFormatter = new Intl.DateTimeFormat('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true
  });
  return timeFormatter.format(date);
}

// Extract unique salespeople from data
export function extractSalespeople(data: any): string[] {
  const salespeople = new Set<string>();
  if (data?.data?.visits?.edges) {
    data.data.visits.edges.forEach((edge: any) => {
      if (edge.node.job.salesperson && edge.node.job.salesperson.name.first) {
        salespeople.add(edge.node.job.salesperson.name.first.trim());
      }
    });
  }
  return Array.from(salespeople).sort();
}

// Function to format the Jobber visits JSON into Markdown or plaintext
export function formatJobList(
  data: any,
  settings: any,
  startDate: Date | null,
  endDate: Date | null,
  formatType: 'markdown' | 'plaintext' = 'markdown',
  filterText: string = ''
): string {

  let output = '';
  let total = 0;
  let jobCount = 0;
  let jobLines = '';

  // Handle all cases: no data, no visits structure, or empty visits
  const visits = data?.data?.visits?.edges ? data.data.visits.edges : []

  // if (visits.length === 0) {
  //   return output;
  // } else {
    // Sort visits based on geo code extracted from the title
    const getGeoCode = (edge: any): string => {
      const titleParts = edge.node.title.match(/(^[^-]+)|(-[A-Z]+-)|([^-\s][^-\n]*[^-\s])|(-[^-\s][^-\n]*[^-\s])/g);
      return (titleParts && titleParts[1]) ? titleParts[1].trim() : '';
    };
    
    // Sort based on settings
    switch (settings.sortBy) {
      case "geoCode":
        visits.sort((a: any, b: any) => getGeoCode(a).localeCompare(getGeoCode(b)));
        break;
      case "value":
        visits.sort((a: any, b: any) => {
          const valueA = a.node.job.total || 0;
          const valueB = b.node.job.total || 0;
          return valueB - valueA;
        });
        break;
      case "geoCodeThenValue":
        visits.sort((a: any, b: any) => {
          const geoCodeA = getGeoCode(a);
          const geoCodeB = getGeoCode(b);
          const valueA = a.node.job.total || 0;
          const valueB = b.node.job.total || 0;

          const geoCodeComparison = geoCodeA.localeCompare(geoCodeB);
          if (geoCodeComparison !== 0) {
            return geoCodeComparison;
          } else {
            return valueB - valueA;
          }
        });
        break;
      case "alphabetical":
        visits.sort((a: any, b: any) => a.node.title.localeCompare(b.node.title));
        break;
      case "salesperson":
        visits.sort((a: any, b: any) => {
          const salespersonA = a.node.job.salesperson ? a.node.job.salesperson.name.first : '';
          const salespersonB = b.node.job.salesperson ? b.node.job.salesperson.name.first : '';
          return salespersonA.localeCompare(salespersonB);
        });
        break;
      case "date":
      default:
        visits.sort((a: any, b: any) => new Date(a.node.startAt).getTime() - new Date(b.node.startAt).getTime());
        break;
    }
    
    // Iterate over the visits and format them
    visits.forEach((edge:any) => {
      const titleParts = edge.node.title.match(/(^[^-]+)|(-[A-Z]+-)|([^-\s][^-\n]*[^-\s])|(-[^-\s][^-\n]*[^-\s])/g);
      let salespersonName = edge.node.job.salesperson ? edge.node.job.salesperson.name.first.trim() : 'Unknown';
      let includingLine = true;
  
      /* 
      TODO: 
      this is where we will need to get values in a more robust way,
      instead of just relying on the title syntax.
      We'll need get the values from the job visit object directly.
      I think ideally, we'll want to allow the user to define the 
      contents of each "line" by selecting tokens from a predefined 
      list of tokens (e.g., lastName, address, customFieldX, etc.)
      Might be nice if they could choose which of the tokens was the 
      link-out to the visit in Jobber. ?? 
      The following will need retooling: 
      - jobIdentifier
      - address
      - geoCode (custom field)
      - workCode (custom field)
      */
      const jobIdentifier = titleParts[0].trim();
      const geoCode = titleParts[1] ? titleParts[1].trim() : '?';
      const address = titleParts[2] ? titleParts[2].trim() : '?';
      const workCode = titleParts[3] ? titleParts[3].trim() : '?';
      const visitId = atob(edge.node.id).replace(/gid:\/\/Jobber\/Visit\//, '');
      const jobberWebUri = edge.node.job.jobberWebUri + '?appointment_id=' + visitId;
      const googleMapsUrl = `https://www.google.com/maps/place/${address.replace(/\s\/\s/g, '+').replace(/\s/g, '+')}+Spokane,WA`;
      const jobdate = formatDate(edge.node.startAt);
  
      const jobStartTime = formatTime(edge.node.startAt);
      const jobEndTime = formatTime(edge.node.endAt);
      const jobtime = (() => {
        if (!settings.showTime) return '';
        let theTime = (jobStartTime && jobStartTime !== "12:00 AM") 
          && (jobEndTime && jobEndTime !== "11:59 PM")
          ? (jobStartTime + "-" + jobEndTime)
          : (jobStartTime && jobStartTime !== "12:00 AM") 
            ? jobStartTime 
            : (jobEndTime && jobEndTime !== "11:59 PM") 
            ? jobEndTime 
            : '';
        theTime = theTime.replace(/\s?(AM|PM)/gi, '').trim();
        return theTime;
      })();
  
      // Annual selector filtering
      if (settings.annual === "exclude") {
        if (jobIdentifier.includes('=')) {
          includingLine = false;
        }
      } else if (settings.annual === "excludeUnconfirmed") {
        if (jobIdentifier.includes('=') && jobIdentifier.startsWith('=')) {
          includingLine = false;
        }
      } else if (settings.annual === "annualOnly") {
        if (!jobIdentifier.includes('=')) {
          includingLine = false;
        }
      } else if (settings.annual === "annualOnlyConfirmed") {
        if (!jobIdentifier.includes('=') || jobIdentifier.startsWith('=')) {
          includingLine = false;
        }
      } else if (settings.annual === "annualOnlyUnconfirmed") {
        if (!jobIdentifier.includes('=') || !jobIdentifier.startsWith('=')) {
          includingLine = false;
        }
      }
  
      // Salesperson filter
      if (includingLine && settings.salespersonFilter === 'showSelected') {
        if (settings.selectedSalespeople.length === 0 || !settings.selectedSalespeople.includes(salespersonName)) {
          includingLine = false;
        }
      }

      // Day filter
      if (includingLine && settings.dayFilter === 'showSelected') {
        const jobDate = new Date(edge.node.startAt);
        const dayOfWeek = jobDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dayOfWeek];
        
        if (!settings.selectedDays || settings.selectedDays.length === 0 || !settings.selectedDays.includes(dayName)) {
          includingLine = false;
        }
      }
  
      // Text filter
      if (includingLine && filterText && !edge.node.title.toLowerCase().includes(filterText.toLowerCase())) {
        includingLine = false;
      }
  
      // IF WE **ARE** INCLUDING THE LINE:
      if (includingLine) {
        jobCount++;
        total += edge.node.job.total || 0;
  
        // Format the job line
        if (formatType === 'markdown') {
          // Dates
          if (settings.showDates) {
            if (settings.dateDisplayType === "all") {
              jobLines += ` **\`${jobdate}\`** `;
            } else if (settings.dateDisplayType === "weekdayOnly" && !jobdate.startsWith("Sun ") && !jobdate.startsWith("Sat ")) {
              jobLines += ` **\`${jobdate}\`** `;
            } else if (settings.dateDisplayType === "weekendOnly" && (jobdate.startsWith("Sun ") || jobdate.startsWith("Sat "))) {
              jobLines += ` **\`${jobdate}\`** `;
            }
          }
  
          // Format the job line as Markdown
          jobLines += `[**${jobIdentifier}**](${jobberWebUri}) ${geoCode} [${address}](${googleMapsUrl}) - ${workCode}`;
  
          // Time
          if (settings.showTime && jobtime !== '') {
            jobLines += ` **\`${jobtime}\`**`;
          }
  
          // Value and Salesperson
          if (settings.showValue) {
            jobLines += ` \`$${edge.node.job.total ? edge.node.job.total : '?'}\``;
          }
          if (settings.showSalesperson) {
            jobLines += ` \`${salespersonName}\``;
          }
        } else 
        if (formatType === 'plaintext') {
          jobLines += `${jobIdentifier} ${geoCode} ${address} - ${workCode}`;
          if (settings.showDates) {
            if (settings.dateDisplayType === "all") {
              jobLines += ` ${jobdate}`;
            } else if (settings.dateDisplayType === "weekdayOnly" && !jobdate.startsWith("Sun ") && !jobdate.startsWith("Sat ")) {
              jobLines += ` ${jobdate}`;
            } else if (settings.dateDisplayType === "weekendOnly" && (jobdate.startsWith("Sun ") || jobdate.startsWith("Sat "))) {
              jobLines += ` ${jobdate}`;
            }
          }
          if (settings.showTime) {
            jobLines += ` ${jobtime}`;
          }
          if (settings.showValue) {
            jobLines += ` - $${edge.node.job.total ? edge.node.job.total : '?'}`;
          }
          if (settings.showSalesperson) {
            jobLines += ` - ${salespersonName}`;
          }
        }
  
        jobLines += '\n\n';
      }
    });
      
    // Add range info header
    if (settings.showRangeInfo && startDate && endDate) {
      const formattedStartDate = formatDate(startDate.toISOString());
      const formattedEndDate = formatDate(endDate.toISOString());
      
      if (formatType === 'markdown') {
        if (settings.showValue) {
          output += `# **${formattedStartDate} &ndash; ${formattedEndDate}** **\`${jobCount} Jobs\`** **\`$${total}\`**\n\n`;
        } else {
          output += `# **${formattedStartDate} &ndash; ${formattedEndDate}** **\`${jobCount} Jobs\`**\n\n`;
        }
      } else if (formatType === 'plaintext') {
        if (settings.showValue) {
          output += `${formattedStartDate}&ndash;${formattedEndDate}, ${jobCount} Jobs, $${total}\n\n------------------------------\n\n`;
        } else {
          output += `${formattedStartDate}&ndash;${formattedEndDate}, ${jobCount} Jobs\n\n------------------------------\n\n`;
        }
      }
    }

    output += jobLines;
    return output;
  // }
}

///////////////////////////////////////////
// The QuickList Component
///////////////////////////////////////////
export default function QuickList() {
  const [showOutput, setShowOutput] = useState(false)
  const [isMarkdownPreviewing, setIsMarkdownPreviewing] = useState(true)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [markdownOutput, setMarkdownOutput] = useState('')
  const [renderedMarkdown, setRenderedMarkdown] = useState('')
  const [copyMenuOpen, setCopyMenuOpen] = useState(false)
  const [copyButtonState, setCopyButtonState] = useState('default')
  const [filterText, setFilterText] = useState('')
  const [data, setData] = useState<any>(null)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [salespeople, setSalespeople] = useState<string[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const dateRangeRef = useRef<HTMLDivElement>(null)
  const flatpickrInstance = useRef<any>(null)

  // Toggle section visibility
  const toggleSection = (section: 'display' | 'sorting' | 'visibility') => {
    const currentExpanded = settings.expandedSections || {
      display: true,
      sorting: true,
      visibility: true
    }
    
    updateSettings({
      expandedSections: {
        ...currentExpanded,
        [section]: !currentExpanded[section]
      }
    })
  }

  // Load settings on mount
  useEffect(() => {
    const savedSettings = loadSettings()
    setSettings(savedSettings)
    
    // Load saved dates
    if (savedSettings.startDate && savedSettings.endDate) {
      const start = new Date(savedSettings.startDate)
      const end = new Date(savedSettings.endDate)
      setStartDate(start)
      setEndDate(end)
    } else {
      // Set default Sunday-Friday range
      const defaultStart = getNextSunday()
      const defaultEnd = getFollowingFriday(defaultStart)
      setStartDate(defaultStart)
      setEndDate(defaultEnd)
    }
  }, [])

  // Initialize flatpickr when dates are set
  useEffect(() => {
    console.log('Flatpickr effect:', { 
      startDate: !!startDate, 
      endDate: !!endDate, 
      windowFlatpickr: !!window.flatpickr, 
      dateRangeRef: !!dateRangeRef.current 
    })
    if (startDate && endDate && window.flatpickr && dateRangeRef.current) {
      console.log('Initializing flatpickr...')
      initializeFlatpickr()
    }
  }, [startDate, endDate])

  // Auto-save settings when they change
  useEffect(() => {
    if (settings !== DEFAULT_SETTINGS) {
      saveSettings()
    }
  }, [settings])

  // Auto-format when relevant data changes
  useEffect(() => {
    formatAndDisplay()
  }, [data, settings, filterText, startDate, endDate])

  // Render markdown when output changes
  useEffect(() => {
    if (markdownOutput && window.marked && isMarkdownPreviewing) {
      renderMarkdown()
    }
  }, [markdownOutput, isMarkdownPreviewing])

  const getNextSunday = (): Date => {
    const now = new Date()
    const day = now.getDay()
    let daysUntilSunday = (7 - day) % 7
    if (daysUntilSunday === 0) daysUntilSunday = 7
    const nextSunday = new Date(now)
    nextSunday.setDate(now.getDate() + daysUntilSunday)
    nextSunday.setHours(0, 0, 0, 0)
    return nextSunday
  }

  const getFollowingFriday = (fromSunday: Date): Date => {
    const friday = new Date(fromSunday)
    friday.setDate(fromSunday.getDate() + 5)
    friday.setHours(23, 59, 59, 999)
    return friday
  }

  const initializeFlatpickr = () => {
    if (flatpickrInstance.current) {
      flatpickrInstance.current.destroy()
    }

    if (dateRangeRef.current) {
      flatpickrInstance.current = window.flatpickr(dateRangeRef.current, {
      inline: true,
      mode: "range",
      defaultDate: [startDate, endDate],
      onReady: function(_selectedDates: Date[], _dateStr: string, instance: any) {
        // Prevent text selection
        instance.calendarContainer.style.userSelect = 'none'
        
        // Simple drag selection implementation
        let isDragging = false
        let startElement: HTMLElement | null = null
        let currentHoverElement: HTMLElement | null = null
        
        const dayElements = instance.calendarContainer.querySelectorAll('.flatpickr-day:not(.flatpickr-disabled)')
        
        dayElements.forEach((dayEl: HTMLElement) => {
          // Mouse events (existing functionality)
          dayEl.addEventListener('mousedown', (e: MouseEvent) => {
            e.preventDefault()
            isDragging = true
            startElement = dayEl
            currentHoverElement = dayEl
            
            // Simulate the first click on this element
            dayEl.click()
          })
          
          dayEl.addEventListener('mouseenter', () => {
            if (isDragging) {
              currentHoverElement = dayEl
            }
          })
          
          // Touch events for mobile support
          dayEl.addEventListener('touchstart', (e: TouchEvent) => {
            e.preventDefault()
            isDragging = true
            startElement = dayEl
            currentHoverElement = dayEl
            
            // Simulate the first click on this element
            dayEl.click()
          }, { passive: false })
        })
        
        // Track mouse movement to continuously update current element
        instance.calendarContainer.addEventListener('mousemove', (e: MouseEvent) => {
          if (isDragging) {
            // Find which day element is under the mouse
            const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement
            if (elementUnderMouse && elementUnderMouse.classList.contains('flatpickr-day') && !elementUnderMouse.classList.contains('flatpickr-disabled')) {
              currentHoverElement = elementUnderMouse
            }
          }
        })
        
        // Track touch movement to continuously update current element
        instance.calendarContainer.addEventListener('touchmove', (e: TouchEvent) => {
          if (isDragging) {
            e.preventDefault()
            // Get the touch point
            const touch = e.touches[0]
            // Find which day element is under the touch
            const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement
            if (elementUnderTouch && elementUnderTouch.classList.contains('flatpickr-day') && !elementUnderTouch.classList.contains('flatpickr-disabled')) {
              currentHoverElement = elementUnderTouch
            }
          }
        }, { passive: false })
        
        // Global mouseup to handle drag ending anywhere
        document.addEventListener('mouseup', () => {
          if (isDragging && startElement && currentHoverElement && currentHoverElement !== startElement) {
            // Simulate the second click on the element we're hovering over
            currentHoverElement.click()
          }
          isDragging = false
          startElement = null
          currentHoverElement = null
        })
        
        // Global touchend to handle drag ending anywhere
        document.addEventListener('touchend', () => {
          if (isDragging && startElement && currentHoverElement && currentHoverElement !== startElement) {
            // Simulate the second click on the element we're hovering over
            currentHoverElement.click()
          }
          isDragging = false
          startElement = null
          currentHoverElement = null
        })
      },
      onChange: function(selectedDates: Date[]) {
        console.log('Calendar onChange triggered:', selectedDates)
        if (selectedDates.length === 2) {
          const start = new Date(selectedDates[0])
          start.setHours(0, 0, 0, 0)
          
          const end = new Date(selectedDates[1])
          end.setHours(23, 59, 59, 999)
          
          setStartDate(start)
          setEndDate(end)
          
          // Update settings with new dates
          setSettings(prev => ({
            ...prev,
            startDate: start.toISOString(),
            endDate: end.toISOString()
          }))
          
          console.log('Updated dates from calendar:', { start, end })
          fetchVisits(start, end)
        }
      }
    })
    }
  }

  const saveSettings = () => {
    try {
      const updatedSettings = {
        ...settings,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        selectedSalespeople: salespeople.filter(sp => {
          const safeId = 'salesperson_' + sp.replace(/[^a-zA-Z0-9]/g, '_')
          const el = document.getElementById(safeId)
          const checkbox = (el instanceof HTMLInputElement) ? el : null
          return checkbox ? checkbox.checked : false
        })
      }
      localStorage.setItem('jobberSettings', JSON.stringify(updatedSettings))
      console.log('Settings saved:', updatedSettings)
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const loadSettings = (): Settings => {
    try {
      const savedSettings = localStorage.getItem('jobberSettings')
      if (savedSettings) {
        return JSON.parse(savedSettings)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
    return DEFAULT_SETTINGS
  }

  const formatAndDisplay = useCallback(() => {
    // Always run formatJobList - it will handle empty data and show range summary appropriately
    const formattedMarkdown = formatJobList(data, settings, startDate, endDate, 'markdown', filterText)
    setMarkdownOutput(formattedMarkdown)
  }, [data, settings, startDate, endDate, filterText])

  const renderMarkdown = () => {
    if (!window.marked) return
    
    const markdownedHTML = window.marked.parse(markdownOutput, { 
      gfm: true, 
      breaks: true 
    })
    setRenderedMarkdown(markdownedHTML)
  }

  const fetchVisits = useCallback(async (startDateParam?: Date, endDateParam?: Date) => {
    const start = startDateParam || startDate
    const end = endDateParam || endDate
    
    if (!start || !end) {
      alert("Please select both start and end dates.")
      return
    }

    setIsRefreshing(true)

    // Format dates for API call using UTC to match database format
    const formatUTCDate = (date: Date): string => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Create a new date object for the end date + 1 day using local time
    const endDatePlusOne = new Date(end)
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1)
    endDatePlusOne.setHours(0, 0, 0, 0)

    const startDateStr = formatUTCDate(start)
    const extendedEndDate = formatUTCDate(endDatePlusOne)

    const startParam = startDateStr + "T00:00:00Z"
    const endParam = extendedEndDate + "T00:00:00Z"
  
    try {
      const response = await fetch(
        `/api/visits?startDate=${encodeURIComponent(startParam)}&endDate=${encodeURIComponent(endParam)}`,
        { headers: { 'Accept': 'application/json' } }
      )
  
      if (response.status === 401) {
        window.location.href = '/api/auth/jobber'
        return
      }
  
      if (!response.ok) {
        throw new Error("Network response was not ok.")
      }
  
      const responseData = await response.json()
      console.log('API Response data:', responseData)
      
      setData(responseData)
      const extractedSalespeople = extractSalespeople(responseData)
      setSalespeople(extractedSalespeople)
      
    } catch (error) {
      console.error("Error fetching visits:", error)
      alert("Error fetching visits. Please try again.")
    } finally {
      setIsRefreshing(false)
    }
  }, [startDate, endDate])

  const navigateToPanel = (panelIndex: number) => {
    setShowOutput(panelIndex === 1)
  }

  const toggleMarkdownPreview = () => {
    setIsMarkdownPreviewing(!isMarkdownPreviewing)
  }

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const result = document.execCommand('copy')
        document.body.removeChild(textArea)
        return result
      }
    } catch (err) {
      console.error('Copy failed:', err)
      return false
    }
  }

  const showCopySuccess = () => {
    setCopyButtonState('success')
    setTimeout(() => {
      setCopyButtonState('default')
    }, 1500)
  }

  const handleCopyClick = async (copyType: string) => {
    setCopyMenuOpen(false)
    let success = false
    
    try {
      if (copyType === 'markdown') {
        success = await copyToClipboard(markdownOutput)
        if (success) showCopySuccess()
      } else if (copyType === 'richtext') {
        if (!renderedMarkdown.trim()) {
          alert('Activate preview first.')
          return
        }
        
        // Try selection-based copy for rich text
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = renderedMarkdown
        document.body.appendChild(tempDiv)
        
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(tempDiv.innerText)
            success = true
          } else {
            const range = document.createRange()
            range.selectNodeContents(tempDiv)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
            success = document.execCommand('copy')
            sel?.removeAllRanges()
            
            if (!success) {
              success = await copyToClipboard(tempDiv.innerText)
            }
          }
        } catch (selectionErr) {
          success = await copyToClipboard(tempDiv.innerText)
        } finally {
          document.body.removeChild(tempDiv)
        }
        
        if (success) showCopySuccess()
      } else if (copyType === 'plaintext') {
        if (!data) {
          alert('No data yet.')
          return
        }
        const plain = formatJobList(data, settings, startDate, endDate, 'plaintext', filterText)
        success = await copyToClipboard(plain)
        if (success) showCopySuccess()
      }
      
      if (!success) {
        alert('Copy failed. Try selecting the text manually and using Ctrl+C (or Cmd+C on Mac).')
      }
      
    } catch (e) {
      console.error('Copy operation failed:', e)
      alert('Copy failed. Try selecting the text manually and using Ctrl+C (or Cmd+C on Mac).')
    }
  }

  const handleRefresh = () => {
    fetchVisits()
  }

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  // Handle clicking outside copy menu to close it
  useEffect(() => {
    const handleClickOutside = () => {
      if (copyMenuOpen) {
        setCopyMenuOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [copyMenuOpen])

  // Fetch visits when component mounts and dates are available
  useEffect(() => {
    if (startDate && endDate) {
      setTimeout(() => {
        fetchVisits()
      }, 100)
    }
  }, [startDate, endDate])

  // Intercept outgoing links to open in new windows
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      
      if (link && link.href && !link.href.startsWith(window.location.origin)) {
        // Don't prevent default - let the browser handle external links naturally
        // Just ensure target="_blank" for better mobile experience
        if (!link.target) {
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
        }
      }
    }

    document.addEventListener('click', handleLinkClick, { passive: true })
    return () => document.removeEventListener('click', handleLinkClick)
  }, [])

  // Refresh data when window regains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      fetchVisits()
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [fetchVisits])


  return (
    <>
      
      <div id="wrapper" className={showOutput ? 'show-output' : ''}>
        <div id="sidebar">
          <header>
            <h1 aria-label="QuickList, for Jobber">
              <svg width="1em" height="1em" viewBox="0 0 395 71" version="1.1" xmlns="http://www.w3.org/2000/svg" >
                <defs>
                    <path d="M80.8701172,63.9960938 C77.6328125,63.9960938 74.9143066,63.2974447 72.7145996,61.9001465 C70.5148926,60.5028483 68.8616536,58.5175781 67.7548828,55.9443359 C66.648112,53.3710938 66.0947266,50.327474 66.0947266,46.8134766 L66.0947266,19.171875 L82.6962891,19.171875 L82.6962891,43.078125 C82.6962891,45.2639974 83.2289225,46.9587402 84.2941895,48.1623535 C85.3594564,49.3659668 86.8605143,49.9677734 88.7973633,49.9677734 C90.097819,49.9677734 91.2045898,49.6910807 92.1176758,49.1376953 C93.0307617,48.5843099 93.7224935,47.7473145 94.1928711,46.626709 C94.6632487,45.5061035 94.8984375,44.101888 94.8984375,42.4140625 L94.8984375,19.171875 L111.5,19.171875 L111.5,63 L95.105957,63 L95.105957,50.9223633 L97.2641602,50.9223633 C95.9083659,54.7407227 93.950765,57.8742676 91.3913574,60.322998 C88.8319499,62.7717285 85.3248698,63.9960938 80.8701172,63.9960938 Z" id="path-1"></path>
                    <filter x="-3.3%" y="-3.3%" width="111.0%" height="113.4%" filterUnits="objectBoundingBox" id="filter-2">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <path d="M118.638672,63 L118.638672,19.171875 L135.240234,19.171875 L135.240234,63 L118.638672,63 Z M126.897949,16.2666016 C124.297038,16.2666016 122.173421,15.5195312 120.5271,14.0253906 C118.880778,12.53125 118.057617,10.6082357 118.057617,8.25634766 C118.057617,5.93212891 118.880778,4.02986654 120.5271,2.54956055 C122.173421,1.06925456 124.297038,0.329101562 126.897949,0.329101562 C129.498861,0.329101562 131.622477,1.06925456 133.268799,2.54956055 C134.91512,4.02986654 135.738281,5.94596354 135.738281,8.29785156 C135.738281,10.6220703 134.91512,12.53125 133.268799,14.0253906 C131.622477,15.5195312 129.498861,16.2666016 126.897949,16.2666016 Z" id="path-3"></path>
                    <filter x="-8.5%" y="-2.4%" width="128.3%" height="109.6%" filterUnits="objectBoundingBox" id="filter-4">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <path d="M164.126953,63.9960938 C159.450846,63.9960938 155.355794,63.0415039 151.841797,61.1323242 C148.327799,59.2231445 145.595459,56.5461426 143.644775,53.1013184 C141.694092,49.6564941 140.71875,45.6513672 140.71875,41.0859375 C140.71875,36.5205078 141.694092,32.5153809 143.644775,29.0705566 C145.595459,25.6257324 148.327799,22.9487305 151.841797,21.0395508 C155.355794,19.1303711 159.450846,18.1757812 164.126953,18.1757812 C167.336589,18.1757812 170.290283,18.6392415 172.988037,19.5661621 C175.685791,20.4930827 178.023844,21.807373 180.002197,23.5090332 C181.98055,25.2106934 183.536947,27.2305501 184.671387,29.5686035 C185.805827,31.9066569 186.428385,34.500651 186.539062,37.3505859 L170.68457,37.3505859 C170.601562,36.3821615 170.40096,35.5105794 170.082764,34.7358398 C169.764567,33.9611003 169.335693,33.2970378 168.796143,32.7436523 C168.256592,32.1902669 167.620199,31.7683105 166.886963,31.4777832 C166.153727,31.1872559 165.344401,31.0419922 164.458984,31.0419922 C162.992513,31.0419922 161.740479,31.4431966 160.702881,32.2456055 C159.665283,33.0480143 158.869792,34.1962891 158.316406,35.6904297 C157.763021,37.1845703 157.486328,38.9830729 157.486328,41.0859375 C157.486328,43.1611328 157.763021,44.9527181 158.316406,46.4606934 C158.869792,47.9686686 159.672201,49.1238607 160.723633,49.9262695 C161.775065,50.7286784 163.020182,51.1298828 164.458984,51.1298828 C165.344401,51.1298828 166.153727,50.9777018 166.886963,50.6733398 C167.620199,50.3689779 168.256592,49.9401042 168.796143,49.3867188 C169.335693,48.8333333 169.764567,48.1554362 170.082764,47.3530273 C170.40096,46.5506185 170.601562,45.6513672 170.68457,44.6552734 L186.539062,44.6552734 C186.539062,47.5052083 185.992594,50.1061198 184.899658,52.4580078 C183.806722,54.8098958 182.26416,56.8505046 180.271973,58.579834 C178.279785,60.3091634 175.914062,61.6442057 173.174805,62.5849609 C170.435547,63.5257161 167.419596,63.9960938 164.126953,63.9960938 Z" id="path-5"></path>
                    <filter x="-3.3%" y="-3.3%" width="110.9%" height="113.1%" filterUnits="objectBoundingBox" id="filter-6">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <path d="M206.792969,53.0390625 L206.792969,33.4492188 L208.702148,33.4492188 L219.825195,19.171875 L238.584961,19.171875 L219.991211,42.3310547 L215.342773,42.3310547 L206.792969,53.0390625 Z M191.93457,63 L191.93457,1.15917969 L208.536133,1.15917969 L208.536133,63 L191.93457,63 Z M220.240234,63 L209.78125,45.9833984 L220.489258,34.3623047 L239.083008,63 L220.240234,63 Z" id="path-7"></path>
                    <filter x="-3.2%" y="-2.4%" width="110.6%" height="109.7%" filterUnits="objectBoundingBox" id="filter-8">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <polygon id="path-9" points="241.573242 63 241.573242 1.15917969 258.838867 1.15917969 258.838867 48.390625 285.484375 48.390625 285.484375 63"></polygon>
                    <filter x="-3.4%" y="-2.4%" width="111.4%" height="109.7%" filterUnits="objectBoundingBox" id="filter-10">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <path d="M290.713867,63 L290.713867,19.171875 L307.31543,19.171875 L307.31543,63 L290.713867,63 Z M298.973145,16.2666016 C296.372233,16.2666016 294.248617,15.5195312 292.602295,14.0253906 C290.955973,12.53125 290.132812,10.6082357 290.132812,8.25634766 C290.132812,5.93212891 290.955973,4.02986654 292.602295,2.54956055 C294.248617,1.06925456 296.372233,0.329101562 298.973145,0.329101562 C301.574056,0.329101562 303.697673,1.06925456 305.343994,2.54956055 C306.990316,4.02986654 307.813477,5.94596354 307.813477,8.29785156 C307.813477,10.6220703 306.990316,12.53125 305.343994,14.0253906 C303.697673,15.5195312 301.574056,16.2666016 298.973145,16.2666016 Z" id="path-11"></path>
                    <filter x="-8.5%" y="-2.4%" width="128.3%" height="109.6%" filterUnits="objectBoundingBox" id="filter-12">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <path d="M335.123047,64.1206055 C330.778971,64.1206055 326.953695,63.4772949 323.647217,62.1906738 C320.340739,60.9040527 317.712158,59.0986328 315.761475,56.7744141 C313.810791,54.4501953 312.683268,51.7524414 312.378906,48.6811523 L328.731445,48.6811523 C328.92513,49.9816081 329.554606,51.0399577 330.619873,51.8562012 C331.68514,52.6724447 333.10319,53.0805664 334.874023,53.0805664 C336.50651,53.0805664 337.77238,52.8246257 338.671631,52.3127441 C339.570882,51.8008626 340.020508,51.1160482 340.020508,50.2583008 C340.020508,49.5388997 339.619303,48.9440104 338.816895,48.4736328 C338.014486,48.0032552 336.783203,47.6297201 335.123047,47.3530273 L326.905273,46.0249023 C322.505859,45.3055013 319.15096,43.8390299 316.840576,41.6254883 C314.530192,39.4119466 313.375,36.5343424 313.375,32.9926758 C313.375,29.9767253 314.198161,27.3688965 315.844482,25.1691895 C317.490804,22.9694824 319.870361,21.2747396 322.983154,20.0849609 C326.095947,18.8951823 329.838216,18.300293 334.209961,18.300293 C338.637044,18.300293 342.434652,18.9297689 345.602783,20.1887207 C348.770915,21.4476725 351.226562,23.2254232 352.969727,25.5219727 C354.712891,27.8185221 355.625977,30.5577799 355.708984,33.7397461 L340.601562,33.7397461 C340.573893,32.4669596 340.01359,31.4016927 338.920654,30.5439453 C337.827718,29.6861979 336.478841,29.2573242 334.874023,29.2573242 C333.269206,29.2573242 332.037923,29.5270996 331.180176,30.0666504 C330.322428,30.6062012 329.893555,31.277181 329.893555,32.0795898 C329.893555,32.7713216 330.246338,33.3592936 330.951904,33.8435059 C331.657471,34.3277181 332.660482,34.6805013 333.960938,34.9018555 L343.34082,36.4790039 C347.961589,37.2537435 351.371826,38.6026204 353.571533,40.5256348 C355.77124,42.4486491 356.871094,45.0564779 356.871094,48.3491211 C356.871094,51.4480794 355.971842,54.1804199 354.17334,56.5461426 C352.374837,58.9118652 349.843099,60.7657064 346.578125,62.107666 C343.313151,63.4496257 339.494792,64.1206055 335.123047,64.1206055 Z" id="path-13"></path>
                    <filter x="-3.4%" y="-3.3%" width="111.2%" height="113.1%" filterUnits="objectBoundingBox" id="filter-14">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                    <path d="M392.232422,19.171875 L392.232422,31.7890625 L359.195312,31.7890625 L359.195312,19.171875 L392.232422,19.171875 Z M366.583008,7.21875 L383.18457,7.21875 L383.18457,46.9794922 C383.18457,48.2799479 383.440511,49.1722819 383.952393,49.6564941 C384.464274,50.1407064 385.48112,50.3828125 387.00293,50.3828125 C387.75,50.3828125 388.697673,50.3828125 389.845947,50.3828125 C390.994222,50.3828125 391.789714,50.3828125 392.232422,50.3828125 L392.232422,63 C391.485352,63 390.247152,63 388.517822,63 C386.788493,63 384.983073,63 383.101562,63 C377.346354,63 373.15446,61.955485 370.525879,59.8664551 C367.897298,57.7774251 366.583008,54.4501953 366.583008,49.8847656 L366.583008,7.21875 Z" id="path-15"></path>
                    <filter x="-4.5%" y="-2.7%" width="115.1%" height="110.8%" filterUnits="objectBoundingBox" id="filter-16">
                        <feOffset dx="2" dy="3" in="SourceAlpha" result="shadowOffsetOuter1"></feOffset>
                        <feColorMatrix values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1  0 0 0 1 0" type="matrix" in="shadowOffsetOuter1"></feColorMatrix>
                    </filter>
                </defs>
                <g id="Artboard" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                    <g id="Path" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-2)" xlinkHref="#path-1"></use>
                        <use fill="#6D6969" xlinkHref="#path-1"></use>
                    </g>
                    <g id="Shape" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-4)" xlinkHref="#path-3"></use>
                        <use fill="#6D6969" xlinkHref="#path-3"></use>
                    </g>
                    <g id="Path" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-6)" xlinkHref="#path-5"></use>
                        <use fill="#6D6969" xlinkHref="#path-5"></use>
                    </g>
                    <g id="Shape" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-8)" xlinkHref="#path-7"></use>
                        <use fill="#6D6969" xlinkHref="#path-7"></use>
                    </g>
                    <g id="Path" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-10)" xlinkHref="#path-9"></use>
                        <use fill="#6D6969" xlinkHref="#path-9"></use>
                    </g>
                    <g id="Shape" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-12)" xlinkHref="#path-11"></use>
                        <use fill="#6D6969" xlinkHref="#path-11"></use>
                    </g>
                    <g id="Path" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-14)" xlinkHref="#path-13"></use>
                        <use fill="#6D6969" xlinkHref="#path-13"></use>
                    </g>
                    <g id="Shape" fill-rule="nonzero">
                        <use fill="black" fill-opacity="1" filter="url(#filter-16)" xlinkHref="#path-15"></use>
                        <use fill="#6D6969" xlinkHref="#path-15"></use>
                    </g>
                    <path d="M61.0306822,31.9844165 C61.0306822,38.8817235 59.6895392,44.6950239 57.0072531,49.4243178 C54.3249671,54.1536116 50.7048893,57.7333543 46.1470197,60.1635458 C41.5891502,62.5937373 36.506924,63.808833 30.9003411,63.808833 C25.2534231,63.808833 20.1560712,62.5836535 15.6082855,60.1332944 C11.0604997,57.6829354 7.45050569,54.0931089 4.77830341,49.3638151 C2.10610114,44.6345212 0.77,38.8413884 0.77,31.9844165 C0.77,25.0871095 2.10610114,19.2738091 4.77830341,14.5445153 C7.45050569,9.81522142 11.0604997,6.23547876 15.6082855,3.80528725 C20.1560712,1.37509575 25.2534231,0.16 30.9003411,0.16 C36.506924,0.16 41.5891502,1.37509575 46.1470197,3.80528725 C50.7048893,6.23547876 54.3249671,9.81522142 57.0072531,14.5445153 C59.6895392,19.2738091 61.0306822,25.0871095 61.0306822,31.9844165 Z M43.726912,31.9844165 C43.726912,28.2735847 43.2378486,25.1425703 42.2597217,22.5913734 C41.2815949,20.0401765 39.839614,18.1040904 37.9337792,16.7831149 C36.0279443,15.4621394 33.683465,14.8016517 30.9003411,14.8016517 C28.1172172,14.8016517 25.7727379,15.4621394 23.8669031,16.7831149 C21.9610682,18.1040904 20.5190874,20.0401765 19.5409605,22.5913734 C18.5628336,25.1425703 18.0737702,28.2735847 18.0737702,31.9844165 C18.0737702,35.6952484 18.5628336,38.8262627 19.5409605,41.3774596 C20.5190874,43.9286565 21.9610682,45.8647427 23.8669031,47.1857181 C25.7727379,48.5066936 28.1172172,49.1671813 30.9003411,49.1671813 C33.683465,49.1671813 36.0279443,48.5066936 37.9337792,47.1857181 C39.839614,45.8647427 41.2815949,43.9286565 42.2597217,41.3774596 C43.2378486,38.8262627 43.726912,35.6952484 43.726912,31.9844165 Z" id="Shape" fill="#6D6969" fill-rule="nonzero"></path>
                    <polygon id="Path" fill="#5DA947" points="23.9688679 39.970772 37.0374496 39.970772 41.7566596 45.9000359 49.7430151 54.9754399 60.1494783 67.56 45.2658158 67.56 37.8844873 58.9686176 32.9232664 51.8292998"></polygon>
                </g>
              </svg>
              <span>for Jobber</span>
            </h1>
          </header>

          <div id="optionsContainer">
            <div className="calendar-container">
              <div ref={dateRangeRef} id="dateRangeCalendar"></div>
            </div>

            <div className="input-group display">
              <h4 className="section-header" onClick={() => toggleSection('display')}>
                <span className={`caret ${settings.expandedSections?.display !== false ? 'expanded' : ''}`}>▼</span>
                Display Options
              </h4>
              {settings.expandedSections?.display !== false && (
                <div className="section-content">
                  <p>
                <input
                  type="checkbox"
                  id="showDatesCheckbox"
                  checked={settings.showDates}
                  onChange={(e) => updateSettings({ showDates: e.target.checked })}
                />
                <label htmlFor="showDatesCheckbox">Dates</label>
              </p>
              
              {settings.showDates && (
                <div id="dateOptionsContainer" className="date-options">
                  <p>
                    <input
                      type="radio"
                      id="showDatesAll"
                      name="dateDisplay"
                      value="all"
                      checked={settings.dateDisplayType === 'all'}
                      onChange={(e) => updateSettings({ dateDisplayType: e.target.value })}
                    />
                    <label htmlFor="showDatesAll">All Dates</label>
                  </p>
                  <p>
                    <input
                      type="radio"
                      id="showDatesWeekdayOnly"
                      name="dateDisplay"
                      value="weekdayOnly"
                      checked={settings.dateDisplayType === 'weekdayOnly'}
                      onChange={(e) => updateSettings({ dateDisplayType: e.target.value })}
                    />
                    <label htmlFor="showDatesWeekdayOnly">Only Weekdays</label>
                  </p>
                  <p>
                    <input
                      type="radio"
                      id="showDatesWeekendOnly"
                      name="dateDisplay"
                      value="weekendOnly"
                      checked={settings.dateDisplayType === 'weekendOnly'}
                      onChange={(e) => updateSettings({ dateDisplayType: e.target.value })}
                    />
                    <label htmlFor="showDatesWeekendOnly">Only Weekends</label>
                  </p>
                </div>
              )}
              
              <p>
                <input
                  type="checkbox"
                  id="showTimeCheckbox"
                  checked={settings.showTime}
                  onChange={(e) => updateSettings({ showTime: e.target.checked })}
                />
                <label htmlFor="showTimeCheckbox">Times</label>
              </p>
              <p>
                <input
                  type="checkbox"
                  id="showValueCheckbox"
                  checked={settings.showValue}
                  onChange={(e) => updateSettings({ showValue: e.target.checked })}
                />
                <label htmlFor="showValueCheckbox">$ Value</label>
              </p>
              <p>
                <input
                  type="checkbox"
                  id="showSalespersonCheckbox"
                  checked={settings.showSalesperson}
                  onChange={(e) => updateSettings({ showSalesperson: e.target.checked })}
                />
                <label htmlFor="showSalespersonCheckbox">Salesperson</label>
              </p>
              <p>
                <input
                  type="checkbox"
                  id="showRangeInfoCheckbox"
                  checked={settings.showRangeInfo}
                  onChange={(e) => updateSettings({ showRangeInfo: e.target.checked })}
                />
                <label htmlFor="showRangeInfoCheckbox">List Summary Title</label>
                  </p>
                </div>
              )}
            </div>

            <div className="input-group sorting">
              <h4 className="section-header" onClick={() => toggleSection('sorting')}>
                <span className={`caret ${settings.expandedSections?.sorting !== false ? 'expanded' : ''}`}>▼</span>
                Sorting
              </h4>
              {settings.expandedSections?.sorting !== false && (
                <div className="section-content">
                  <p>
                <label htmlFor="sortBySelect">Sort by:</label>
                <select
                  id="sortBySelect"
                  value={settings.sortBy}
                  onChange={(e) => updateSettings({ sortBy: e.target.value })}
                >
                  <option value="date">Date</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="value">$ Value</option>
                  <option value="geoCode">GeoCode</option>
                  <option value="geoCodeThenValue">GeoCode, then $ Value</option>
                  <option value="salesperson">Salesperson</option>
                </select>
                  </p>
                </div>
              )}
            </div>

            <div className="input-group visibility">
              <h4 className="section-header" onClick={() => toggleSection('visibility')}>
                <span className={`caret ${settings.expandedSections?.visibility !== false ? 'expanded' : ''}`}>▼</span>
                Inclusion
              </h4>
              {settings.expandedSections?.visibility !== false && (
              <div className="section-content">
                <p>
                  <label htmlFor="annualSelect">Annual Jobs:</label>
                  <select
                    id="annualSelect"
                    value={settings.annual}
                    onChange={(e) => updateSettings({ annual: e.target.value })}
                  >
                    <option value="include">Include Annual Jobs</option>
                    <option value="exclude">Exclude Annual Jobs</option>
                    <option value="excludeUnconfirmed">Exclude Unconfirmed Annual Jobs</option>
                    <option value="annualOnly">Show Only Annual Jobs</option>
                    <option value="annualOnlyConfirmed">Show Only *Confirmed* Annual Jobs</option>
                    <option value="annualOnlyUnconfirmed">Show Only *Unconfirmed* Annual Jobs</option>
                  </select>
                </p>
                <p>
                  <label htmlFor="salespersonFilterSelect">Salesperson:</label>
                  <select
                    id="salespersonFilterSelect"
                    value={settings.salespersonFilter}
                    onChange={(e) => updateSettings({ salespersonFilter: e.target.value })}
                  >
                    <option value="all">Include All</option>
                    <option value="showSelected">Include Selected...</option>
                  </select>
                </p>

                {settings.salespersonFilter === 'showSelected' && (
                <div id="salespersonCheckboxes" className="salesperson-checkboxes salesperson-checkboxes-visible">
                  <p className="salesperson-select-all">
                    <input
                      type="checkbox"
                      id="salesperson_all"
                      checked={salespeople.length > 0 && salespeople.every(sp => 
                        settings.selectedSalespeople.includes(sp)
                      )}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateSettings({ selectedSalespeople: [...salespeople] })
                        } else {
                          updateSettings({ selectedSalespeople: [] })
                        }
                      }}
                    />
                    <label htmlFor="salesperson_all" className="salesperson-select-all-label">
                      Select All:
                    </label>
                  </p>
                  {salespeople.map(salesperson => (
                    <p key={salesperson} className="salesperson-item">
                      <input
                        type="checkbox"
                        id={`salesperson_${salesperson.replace(/[^a-zA-Z0-9]/g, '_')}`}
                        checked={settings.selectedSalespeople.includes(salesperson)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateSettings({
                              selectedSalespeople: [...settings.selectedSalespeople, salesperson]
                            })
                          } else {
                            updateSettings({
                              selectedSalespeople: settings.selectedSalespeople.filter(sp => sp !== salesperson)
                            })
                          }
                        }}
                      />
                      <label htmlFor={`salesperson_${salesperson.replace(/[^a-zA-Z0-9]/g, '_')}`}>
                        {salesperson}
                      </label>
                    </p>
                  ))}
                </div>
                )}

                <p>
                  <label htmlFor="dayFilterSelect">Days:</label>
                  <select
                    id="dayFilterSelect"
                    value={settings.dayFilter}
                    onChange={(e) => updateSettings({ dayFilter: e.target.value })}
                  >
                    <option value="all">Include All Days</option>
                    <option value="showSelected">Include Selected...</option>
                  </select>
                </p>

                {settings.dayFilter === 'showSelected' && (
                <div id="dayCheckboxes" className="salesperson-checkboxes salesperson-checkboxes-visible">
                  <p className="salesperson-select-all">
                    <input
                      type="checkbox"
                      id="day_all"
                      checked={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].every(day => 
                        settings.selectedDays?.includes(day)
                      )}
                      onChange={(e) => {
                        const allDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        if (e.target.checked) {
                          updateSettings({ selectedDays: [...allDays] })
                        } else {
                          updateSettings({ selectedDays: [] })
                        }
                      }}
                    />
                    <label htmlFor="day_all" className="salesperson-select-all-label">
                      Select All:
                    </label>
                  </p>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <p key={day} className="salesperson-item">
                      <input
                        type="checkbox"
                        id={`day_${day}`}
                        checked={settings.selectedDays?.includes(day) || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateSettings({
                              selectedDays: [...(settings.selectedDays || []), day]
                            })
                          } else {
                            updateSettings({
                              selectedDays: (settings.selectedDays || []).filter(d => d !== day)
                            })
                          }
                        }}
                      />
                      <label htmlFor={`day_${day}`}>
                        {day}
                      </label>
                    </p>
                  ))}
                </div>
                )}

                </div>
              )}
            </div>

            <p>
              <button 
                id="refreshDataBtn" 
                className={`button active ${isRefreshing ? 'refreshing' : ''}`}
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </p>
          </div>
        </div>

        <div id="outputContainer">
          <div className="button-bar">
            <input
              type="text"
              id="filterInput"
              placeholder="Filter by..."
              className="filter-input"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <button
              id="previewMarkdownBtn"
              className={`preview-button button ${isMarkdownPreviewing ? 'active' : ''}`}
              title="Preview Markdown"
              onClick={toggleMarkdownPreview}
            >
              M
            </button>
            <div className="copy-dropdown-container">
              <button
                className={`copy-dropdown-trigger ${copyButtonState === 'success' ? 'success' : ''} ${copyMenuOpen ? 'menu-open' : ''}`}
                id="copyDropdownTrigger"
                onClick={(e) => {
                  e.stopPropagation()
                  if (copyButtonState === 'default') {
                    setCopyMenuOpen(!copyMenuOpen)
                  }
                }}
              >
                {copyButtonState === 'success' ? '👍 Copied!' : 'Copy List as...'}
              </button>
              <div 
                className={`copy-dropdown-menu ${copyMenuOpen ? 'show' : ''}`} 
                id="copyDropdownMenu"
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className="copy-dropdown-item" 
                  onClick={() => handleCopyClick('markdown')}
                >
                  Markdown
                </button>
                <button 
                  className="copy-dropdown-item" 
                  onClick={() => handleCopyClick('richtext')}
                >
                  Rich Text
                </button>
                <button 
                  className="copy-dropdown-item" 
                  onClick={() => handleCopyClick('plaintext')}
                >
                  Plain Text
                </button>
              </div>
            </div>
          </div>
          
          <textarea
            id="markdown-output"
            className={`output ${isMarkdownPreviewing ? 'output-hidden' : 'output-visible'}`}
            placeholder="Your Markdown will go here."
            value={markdownOutput}
            onChange={(e) => setMarkdownOutput(e.target.value)}
          />
          
          <div
            id="renderedMarkdown"
            className={`rendered-markdown ${isMarkdownPreviewing ? 'rendered-markdown-visible' : 'rendered-markdown-hidden'}`}
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        </div>
      </div>

      {/* Mobile navigation buttons */}
      <button
        id="viewListBtn"
        className={`mobile-nav-button ${showOutput ? 'mobile-nav-button-hidden' : 'mobile-nav-button-visible'}`}
        onClick={() => navigateToPanel(1)}
      >
        View List 👉🏼
      </button>
      <button
        id="optionsBtn"
        className={`mobile-nav-button ${showOutput ? 'mobile-nav-button-visible' : 'mobile-nav-button-hidden'}`}
        onClick={() => navigateToPanel(0)}
      >
        👈🏼 Options
      </button>
    </>
  )
}