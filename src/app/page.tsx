'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Script from 'next/script'
import { formatJobList, extractSalespeople, formatDate } from '@/utils/jobFormatter'

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
  selectedSalespeople: []
}

declare global {
  interface Window {
    flatpickr: any;
    marked: any;
  }
}

import AuthLoading from '@/components/AuthLoading'

export default function Home() {
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  
  const dateRangeRef = useRef<HTMLDivElement>(null)
  const flatpickrInstance = useRef<any>(null)
  
  // Check authentication on mount
  useEffect(() => {
    checkAuthentication()
  }, [])

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
    if (data) {
      formatAndDisplay()
    }
  }, [data, settings, filterText, startDate, endDate])

  // Render markdown when output changes
  useEffect(() => {
    if (markdownOutput && window.marked && isMarkdownPreviewing) {
      renderMarkdown()
    }
  }, [markdownOutput, isMarkdownPreviewing])

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/authenticated', { 
        headers: { 'Accept': 'application/json' } 
      })
      setIsAuthenticated(response.ok)
      if (!response.ok) {
        window.location.href = '/api/auth/jobber'
        return
      }
    } catch (error) {
      console.log('Not authenticated, redirecting to login...')
      window.location.href = '/api/auth/jobber'
      return
    }
  }

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

    flatpickrInstance.current = window.flatpickr(dateRangeRef.current, {
      inline: true,
      mode: "range",
      defaultDate: [startDate, endDate],
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

  const saveSettings = () => {
    try {
      const updatedSettings = {
        ...settings,
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
        selectedSalespeople: salespeople.filter(sp => {
          const checkbox = document.getElementById(`salesperson_${sp.replace(/[^a-zA-Z0-9]/g, '_')}`) as HTMLInputElement
          return checkbox?.checked
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
    if (!data) {
      setMarkdownOutput('')
      return
    }
    
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

  const fetchVisits = async (startDateParam?: Date, endDateParam?: Date) => {
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
  }

  const navigateToPanel = (panelIndex: number) => {
    setShowOutput(panelIndex === 1)
  }

  const toggleMarkdownPreview = () => {
    setIsMarkdownPreviewing(!isMarkdownPreviewing)
  }

  const copyToClipboard = (text: string): boolean => {
    try {
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

  const handleCopyClick = (copyType: string) => {
    setCopyMenuOpen(false)
    let success = false
    
    try {
      if (copyType === 'markdown') {
        success = copyToClipboard(markdownOutput)
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
          const range = document.createRange()
          range.selectNodeContents(tempDiv)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
          success = document.execCommand('copy')
          sel?.removeAllRanges()
          
          if (!success) {
            success = copyToClipboard(tempDiv.innerText)
          }
        } catch (selectionErr) {
          success = copyToClipboard(tempDiv.innerText)
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
        success = copyToClipboard(plain)
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
    if (startDate && endDate && isAuthenticated) {
      setTimeout(() => {
        fetchVisits()
      }, 100)
    }
  }, [startDate, endDate, isAuthenticated])

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

  // Don't render anything until authentication is checked
  if (isAuthenticated === null) {
    return <AuthLoading state="checking" />
  }

  if (!isAuthenticated) {
    return <AuthLoading state="redirecting" />
  }

  const handleFlatpickrLoad = () => {
    console.log('Flatpickr script loaded')
    if (startDate && endDate && dateRangeRef.current) {
      console.log('Initializing flatpickr after script load...')
      initializeFlatpickr()
    }
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" />
      <Script 
        src="https://cdn.jsdelivr.net/npm/flatpickr" 
        onLoad={handleFlatpickrLoad}
      />
      
      <div id="wrapper" className={showOutput ? 'show-output' : ''}>
        <div id="sidebar">
          <header>
            <h1>QuickList</h1>
            <span>for Jobber</span>
          </header>

          <div id="optionsContainer">
            <div className="calendar-container">
              <div ref={dateRangeRef} id="dateRangeCalendar"></div>
            </div>

            <div className="input-group">
              <h4>Display</h4>
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
                <label htmlFor="showRangeInfoCheckbox">Range Summary</label>
              </p>
            </div>

            <div className="input-group">
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

            <div className="input-group">
              <h4>Visibility</h4>
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
            </div>

            <p>
              <button 
                id="refreshDataBtn" 
                className={`button active ${isRefreshing ? 'refreshing' : ''}`}
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? '⟳ Refreshing...' : 'Refresh Data'}
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
                className={`copy-dropdown-trigger ${copyButtonState === 'success' ? 'success' : ''}`}
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
