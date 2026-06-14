'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Label } from '@/core/ui/label'

export interface GoogleFontItem {
  family: string;
  menu: string;
  variants?: string[];
  files?: Record<string, string>;
}

export interface GoogleFontSelectorProps {
  value: string;
  onChange: (font: GoogleFontItem | null) => void;
  fontList: GoogleFontItem[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}

export function GoogleFontSelector({ value, onChange, fontList, isLoading, searchTerm, setSearchTerm }: GoogleFontSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredFonts = useMemo(() => {
    return fontList
      .filter(font => font.family.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.family.localeCompare(b.family))
  }, [fontList, searchTerm])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="font-search">
          <h3>Google Font</h3>
        </Label>
        <span className="text-xs text-gray-500">
          (View all on{' '}
          <a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
            Google Fonts
          </a>
          )
        </span>
      </div>
      <div ref={containerRef} className="relative">
        <input
          id="font-search"
          type="text"
          value={open ? searchTerm : value}
          placeholder={isLoading ? 'Loading...' : 'Search font...'}
          disabled={isLoading}
          className="w-full p-2 border rounded-md text-sm"
          onFocus={() => {
            setSearchTerm('')
            setOpen(true)
          }}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {open && (
          <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto border rounded-md bg-white shadow-lg text-sm">
            {filteredFonts.length === 0
              ? <li className="px-3 py-2 text-gray-400">No results</li>
              : filteredFonts.map(font => (
                <li
                  key={font.family}
                  className={`px-3 py-2 cursor-pointer hover:bg-muted ${font.family === value ? 'bg-muted font-semibold' : ''}`}
                  onMouseDown={() => {
                    onChange(font)
                    setSearchTerm('')
                    setOpen(false)
                  }}
                >
                  {font.family}
                </li>
              ))
            }
          </ul>
        )}
      </div>
    </div>
  )
}
