'use client'

import Image from 'next/image'
import { Input } from '@/core/ui/input'
import { Button } from '@/core/ui/button'
import { Textarea } from '@/core/ui/textarea'
import { Label } from '@/core/ui/label'
import { GoogleFontSelector, GoogleFontItem } from './_components/GoogleFontSelector'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import opentype from 'opentype.js'
import makerjs from 'makerjs'
import { Switch } from '@/core/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select'
import { toast } from 'sonner'
import { ScrollArea } from '@/core/ui/scroll-area'
import { CustomFontUploader } from './_components/CustomFontUploader'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/core/ui/sheet'
import { Menu } from 'lucide-react'
import { Header } from './_components/Header'
import { useTranslations } from 'next-intl'

type FillRule = 'nonzero' | 'evenodd';

const RECOMMEND_FONTS = ['Mea Culpa', 'Lily Script One', 'Kapakana', 'Protest Riot', 'Sonsie One', 'Pacifico', 'Sofadi One', 'Risque', 'Oooh Baby']
const RECOMMEND_TEXT_FONTS = ['Roboto', 'Varela Round', 'Noto Sans Nabataean', 'Crimson Text', 'Oxygen', 'Overpass']
const RECOMMEND_TOOLS = [
  { title: 'Personal Blog', href: 'https://jiuran.fun' },
  { title: 'AI Answer generator', href: 'https://aianswergenerate.com' },
]

const ANIMATION_CONFIGS = {
  signature: {
    duration: { slow: '6s', normal: '3s', fast: '1.5s' },
    css: (d: string, p: string, c: string) => `
      .animated-svg path {
        stroke-dasharray: 2400; stroke-dashoffset: 2400; fill: transparent;
        animation: drawSignature ${d} linear infinite both; animation-play-state: ${p};
        stroke-width: 2px; stroke: ${c};
      }
      @keyframes drawSignature {
        0% { stroke-dashoffset: 2400; } 10% { fill: transparent; }
        25%, 85% { stroke-dashoffset: 0; fill: ${c}; }
        95%, to { stroke-dashoffset: 2400; fill: transparent; }
      }`,
  },
  draw: {
    duration: { slow: '6s', normal: '3s', fast: '1.5s' },
    css: (d: string, p: string, c: string) => `
      .animated-svg path {
        stroke-dasharray: 1000; stroke-dashoffset: 1000; stroke: ${c};
        animation: draw ${d} ease-in-out infinite; animation-play-state: ${p};
      }
      @keyframes draw {
        0% { stroke-dashoffset: 1000; } 50% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1000; }
      }`,
  },
  'fade-in': {
    duration: { slow: '6s', normal: '3s', fast: '1.5s' },
    css: (d: string, p: string, c: string) => `
      .animated-svg path {
        opacity: 0; fill: ${c};
        animation: fadeIn ${d} ease-in-out infinite; animation-play-state: ${p};
      }
      @keyframes fadeIn {
        0% { opacity: 0; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.8); }
      }`,
  },
  pulse: {
    duration: { slow: '6s', normal: '3s', fast: '1.5s' },
    css: (d: string, p: string, c: string) => `
      .animated-svg path {
        fill: ${c}; animation: pulse ${d} ease-in-out infinite; animation-play-state: ${p};
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; }
      }`,
  },
}

function buildAnimationCSS(type: string, speed: string, paused: boolean, fillColor: string) {
  const config = ANIMATION_CONFIGS[type as keyof typeof ANIMATION_CONFIGS]
  if (!config) return ''
  const duration = config.duration[speed as keyof typeof config.duration]
  const playState = paused ? 'paused' : 'running'
  return `<style>${config.css(duration, playState, fillColor)}</style>`
}

function parseVariant(variant: string): { weight: number; italic: boolean } {
  if (variant === 'regular') return { weight: 400, italic: false }
  if (variant === 'italic') return { weight: 400, italic: true }
  const italic = variant.endsWith('italic')
  const weight = parseInt(italic ? variant.slice(0, -6) : variant) || 400
  return { weight, italic }
}

function buildVariantKey(weight: number, italic: boolean): string {
  if (weight === 400) return italic ? 'italic' : 'regular'
  return italic ? `${weight}italic` : `${weight}`
}

function findClosestVariant(variants: string[], weight: number, italic: boolean): string {
  const key = buildVariantKey(weight, italic)
  if (variants.includes(key)) return key
  const parsed = variants.map(v => ({ v, ...parseVariant(v) }))
  const sameItalic = parsed.filter(x => x.italic === italic)
  const pool = sameItalic.length ? sameItalic : parsed
  return pool.reduce((a, b) => Math.abs(a.weight - weight) <= Math.abs(b.weight - weight) ? a : b).v
}

export default function Home() {
  const t = useTranslations()
  const [selectedFont, setSelectedFont] = useState<GoogleFontItem | null>({
    family: 'Mea Culpa',
    variants: ['regular'],
    files: {
      regular: 'https://fonts.gstatic.com/s/meaculpa/v6/AMOTz4GcuWbEIuza8jsZms0QW3mqyg.ttf'
    },
    menu: 'https://fonts.gstatic.com/s/meaculpa/v6/AMOTz4GcuWbEIuza8jsZms0QW3mqyg.ttf'
  })
  const [selectedVariant, setSelectedVariant] = useState<string>('regular')
  const [text, setText] = useState('Nexus')
  const [fontSize, setFontSize] = useState(50)
  const [stroke, setStroke] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState('0')
  const [strokeEnabled, setStrokeEnabled] = useState(false)
  const [fill, setFill] = useState('#000000')
  const strokeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fillTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [currentFont, setCurrentFont] = useState<opentype.Font | null>(null)
  
  // 新增配置项
  const [union, setUnion] = useState(true)
  const [filled, setFilled] = useState(true)
  const [kerning, setKerning] = useState(true)
  const [separate, setSeparate] = useState(false)
  const [bezierAccuracy, setBezierAccuracy] = useState(0.5)
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [letterSpacingStr, setLetterSpacingStr] = useState('0')
  const [ligatures, setLigatures] = useState(true)
  const [underline, setUnderline] = useState(false)
  const [strikethrough, setStrikethrough] = useState(false)
  const [fillRule, setFillRule] = useState<FillRule>('evenodd')
  const [dxfUnits, setDxfUnits] = useState('mm')

  // 动画相关状态
  const [animationEnabled, setAnimationEnabled] = useState(false)
  const [animationType, setAnimationType] = useState('signature')
  const [animationSpeed, setAnimationSpeed] = useState('normal')
  const [animationPaused, setAnimationPaused] = useState(false)

  const [fontList, setFontList] = useState<GoogleFontItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [debouncedText, setDebouncedText] = useState(text)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), 200)
    return () => clearTimeout(timer)
  }, [text])

  const { weight: currentWeight, italic: currentItalic } = parseVariant(selectedVariant)
  const availableWeights = useMemo(() => {
    if (!selectedFont) return [400]
    const ws = new Set((selectedFont.variants ?? []).map(v => parseVariant(v).weight))
    return Array.from(ws).sort((a, b) => a - b)
  }, [selectedFont])

  // 使用 useMemo 缓存字体加载
  const fontUrl = useMemo(() => {
    if (!selectedFont) return null
    if (selectedVariant && selectedFont.files && selectedFont.files[selectedVariant]) {
      return selectedFont.files[selectedVariant]
    }
    return selectedFont.menu
  }, [selectedFont, selectedVariant])

  const [customFont, setCustomFont] = useState<opentype.Font | null>(null)
  const [customFontName, setCustomFontName] = useState<string>('')
  
  // 修改 loadFont 函数以支持自定义字体
  const loadFont = useCallback(
    (url: string | opentype.Font) => {
      if (typeof url === 'string') {
        opentype.load(url, (err: Error | null, font: opentype.Font | null) => {
          if (!err && font) {
            setCurrentFont(font)
          } else {
            setCurrentFont(null)
          }
        })
      } else {
        setCurrentFont(url)
      }
    },
    []
  )

  // 添加自定义字体处理函数
  const handleCustomFontLoaded = useCallback((font: opentype.Font, fileName: string) => {
    setCustomFont(font)
    setCustomFontName(fileName)
    setCurrentFont(font)
  }, [])

  const handleCustomFontRemoved = useCallback(() => {
    setCustomFont(null)
    setCustomFontName('')
    if (fontUrl) {
      loadFont(fontUrl)
    }
  }, [fontUrl, loadFont])

  // 修改 useEffect 以支持自定义字体
  useEffect(() => {
    if (customFont) {
      setCurrentFont(customFont)
    } else if (fontUrl) {
      loadFont(fontUrl)
    }
  }, [fontUrl, customFont, loadFont])

  const textModel = useMemo((): makerjs.IModel | null => {
    if (!currentFont || !debouncedText) return null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const font = currentFont as any
      const glyphPaths = font.getPaths(debouncedText, 0, 0, fontSize, {
        kerning,
        letterSpacing: letterSpacing / fontSize,
        features: { liga: ligatures, rlig: ligatures },
      })
      const combinedModels: { [key: string]: makerjs.IModel } = {}
      for (let i = 0; i < glyphPaths.length; i++) {
        const pathData = glyphPaths[i].toPathData(Math.max(1, Math.round(bezierAccuracy * 8)))
        if (pathData && pathData.trim() !== '') {
          // fromSVGPathData handles Y-flip (SVG Y-down → makerjs Y-up) internally
          combinedModels[`g${i}`] = makerjs.importer.fromSVGPathData(pathData)
        }
      }
      const model: makerjs.IModel = { models: combinedModels }
      if (separate) {
        for (const key in model.models) model.models![key].layer = key
      }
      return model
    } catch {
      return null
    }
  }, [currentFont, debouncedText, fontSize, kerning, ligatures, separate, bezierAccuracy, letterSpacing])

  const svgString = useMemo(() => {
    if (!currentFont || !debouncedText) return ''
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const font = currentFont as any
      const opts = {
        kerning,
        letterSpacing: letterSpacing / fontSize,
        features: { liga: ligatures, rlig: ligatures },
      }
      const glyphPaths = font.getPaths(debouncedText, 0, 0, fontSize, opts)
      const pathDataList: string[] = glyphPaths
        .map((p: any) => p.toPathData(Math.max(1, Math.round(bezierAccuracy * 8))))  // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((d: string) => d?.trim())

      if (!pathDataList.length) return ''

      let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity
      for (const p of glyphPaths) {
        const bb = p.getBoundingBox()
        if (isFinite(bb.x1)) { bx1 = Math.min(bx1, bb.x1); bx2 = Math.max(bx2, bb.x2) }
        if (isFinite(bb.y1)) { by1 = Math.min(by1, bb.y1); by2 = Math.max(by2, bb.y2) }
      }
      if (!isFinite(bx1)) return ''

      // Decorations: underline / strikethrough
      const scale = fontSize / ((font.unitsPerEm as number) ?? 1000)
      const decorFill = filled ? fill : (strokeEnabled ? stroke : fill)
      const decorRects: { y: number; h: number }[] = []
      if (underline) {
        const uy = -((font.tables?.post?.underlinePosition as number) ?? -100) * scale
        const uh = Math.max(1, ((font.tables?.post?.underlineThickness as number) ?? 50) * scale)
        decorRects.push({ y: uy - uh / 2, h: uh })
      }
      if (strikethrough) {
        const sy = -((font.tables?.os2?.sStrikeoutPosition as number) ?? 300) * scale
        const sh = Math.max(1, ((font.tables?.os2?.sStrikeoutSize as number) ?? 50) * scale)
        decorRects.push({ y: sy - sh / 2, h: sh })
      }
      for (const d of decorRects) {
        by1 = Math.min(by1, d.y)
        by2 = Math.max(by2, d.y + d.h)
      }

      const sw = parseFloat(strokeWidth) || 0
      const x1 = bx1 - sw / 2
      const y1 = by1 - sw / 2
      const x2 = bx2 + sw / 2
      const y2 = by2 + sw / 2
      const w = x2 - x1
      const h = y2 - y1

      const pathAttrs = [
        filled ? `fill="${fill}"` : 'fill="none"',
        `fill-rule="${fillRule}"`,
        strokeEnabled ? `stroke="${stroke}"` : '',
        strokeEnabled ? `stroke-width="${strokeWidth}"` : '',
      ].filter(Boolean).join(' ')

      const pathEls = pathDataList
        .map((d: string, i: number) => `  <path${separate ? ` id="g${i}"` : ''} d="${d}" ${pathAttrs}/>`)
        .join('\n')
      const decorEls = decorRects
        .map(d => `  <rect x="${bx1}" y="${d.y}" width="${bx2 - bx1}" height="${d.h}" fill="${decorFill}"/>`)
        .join('\n')

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1} ${y1} ${w} ${h}" width="${w}" height="${h}">\n${pathEls}${decorEls ? '\n' + decorEls : ''}\n</svg>`

      if (animationEnabled) {
        const css = buildAnimationCSS(animationType, animationSpeed, animationPaused, fill)
        svg = svg.replace(/<svg([^>]*)>/, `<svg$1 class="animated-svg">${css}`)
      }
      return svg
    } catch {
      return ''
    }
  }, [currentFont, debouncedText, fontSize, kerning, ligatures, separate, bezierAccuracy, letterSpacing, filled, fill, stroke, strokeWidth, strokeEnabled, fillRule, animationEnabled, animationType, animationSpeed, animationPaused, underline, strikethrough])

  const previewSvg = useMemo(() => {
    if (!svgString) return ''
    return svgString.replace('<svg', '<svg style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;"')
  }, [svgString])

  // DXF export — independent from SVG visual options
  const dxfString = useMemo(() => {
    if (!textModel) return ''
    try {
      return makerjs.exporter.toDXF(textModel, { units: dxfUnits, usePOLYLINE: true })
    } catch {
      return ''
    }
  }, [textModel, dxfUnits])

  const downloadDxf = () => {
    if (!dxfString) return
    const blob = new Blob([dxfString], { type: 'application/dxf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${text}.dxf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('notifications.dxfDownloaded'))
  }

  // When selectedFont changes, preserve weight/italic preference if variant exists
  useEffect(() => {
    if (!selectedFont) return
    const variants = selectedFont.variants ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setSelectedVariant(findClosestVariant(variants, currentWeight, currentItalic))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFont])

  useEffect(() => {
    setIsLoading(true)
    fetch(
      'https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyBGY1GPOKrkxGQTQV_qoo7oPLiVh5eaC8g'
    )
      .then((res) => res.json())
      .then((data) => {
        setFontList(data.items || [])
      })
      .finally(() => {
        setIsLoading(false)
        loadFont(selectedFont?.files?.regular || '')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [isOpen, setIsOpen] = useState(false)

  const renderAnimationSettings = () => (
    <div className="border-t pt-4 mt-4 flex flex-col gap-6">
      <h3 className="text-sm font-semibold">{t('animation.title')}</h3>
      
      <div className="flex items-center justify-between">
        <Label htmlFor="animation-enabled">
          <h3>{t('animation.enable')}</h3>
        </Label>
        <Switch 
          id="animation-enabled" 
          checked={animationEnabled} 
          onCheckedChange={setAnimationEnabled} 
        />
      </div>

      {animationEnabled && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="animation-type">
              <h3>{t('animation.type')}</h3>
            </Label>
            <Select value={animationType} onValueChange={setAnimationType}>
              <SelectTrigger>
                <SelectValue placeholder="Select animation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="signature">{t('animation.types.signature')}</SelectItem>
                <SelectItem value="draw">{t('animation.types.draw')}</SelectItem>
                <SelectItem value="fade-in">{t('animation.types.fadeIn')}</SelectItem>
                <SelectItem value="pulse">{t('animation.types.pulse')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="animation-speed">
              <h3>{t('animation.speed')}</h3>
            </Label>
            <Select value={animationSpeed} onValueChange={setAnimationSpeed}>
              <SelectTrigger>
                <SelectValue placeholder="Select speed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">{t('animation.speeds.slow')}</SelectItem>
                <SelectItem value="normal">{t('animation.speeds.normal')}</SelectItem>
                <SelectItem value="fast">{t('animation.speeds.fast')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="animation-paused">
              <h3>{t('animation.pause')}</h3>
            </Label>
            <Switch 
              id="animation-paused" 
              checked={animationPaused} 
              onCheckedChange={setAnimationPaused} 
            />
          </div>
        </>
      )}
    </div>
  )

  const renderSettings = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-4">
        <Image src="/favicon-32x32.png" alt={t('title')} width={24} height={24} className="rounded-full" />
        <h1 className="text-xl font-bold">
          {t('title')}
        </h1>
      </div>
      <h2 className="text-lg font-bold mb-2">{t('settings.title')}</h2>
      {/* 配置面板内容 */}
      <div className="mb-4">
        <GoogleFontSelector 
          value={selectedFont?.family || ''} 
          onChange={(font) => {
            if (!customFont) {
              setSelectedFont(font)
            } else {
              toast.info(t('notifications.customFontActive'))
            }
          }}
          fontList={fontList}
          isLoading={isLoading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </div>
      
      {/* 自定义字体上传组件 */}
      <div className="mb-4">
        <Label className="mb-2 block">
          <h3>
            {t('settings.customFont')}
            <span className="text-xs text-gray-500 ms-2">{t('settings.customFontOptional')}</span>
          </h3>
        </Label>
        <CustomFontUploader 
          onFontLoaded={handleCustomFontLoaded}
          onFontRemoved={handleCustomFontRemoved}
          currentFileName={customFontName}
        />
      </div>
      
      {/* Text style: B / I / U / S + weight */}
      <div className="flex flex-col gap-3">
        <Label>{t('settings.fontStyle')}</Label>
        <div className="flex items-center gap-2">
          {selectedFont && !customFont && (() => {
            const variants = selectedFont.variants ?? []
            const hasBold = variants.some(v => parseVariant(v).weight >= 700)
            const hasItalic = variants.some(v => parseVariant(v).italic)
            const boldDisabled = currentWeight < 700 && !hasBold
            const italicDisabled = !currentItalic && !hasItalic
            return (
              <>
                <button
                  title="Bold"
                  disabled={boldDisabled}
                  onClick={() => setSelectedVariant(findClosestVariant(variants, currentWeight >= 700 ? 400 : 700, currentItalic))}
                  className={`w-9 h-9 font-bold border rounded text-sm transition-colors ${currentWeight >= 700 ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'} ${boldDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >B</button>
                <button
                  title="Italic"
                  disabled={italicDisabled}
                  onClick={() => setSelectedVariant(findClosestVariant(variants, currentWeight, !currentItalic))}
                  className={`w-9 h-9 italic border rounded text-sm transition-colors ${currentItalic ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'} ${italicDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >I</button>
              </>
            )
          })()}
          <button
            title="Underline"
            onClick={() => setUnderline(!underline)}
            className={`w-9 h-9 underline border rounded text-sm transition-colors ${underline ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >U</button>
          <button
            title="Strikethrough"
            onClick={() => setStrikethrough(!strikethrough)}
            className={`w-9 h-9 line-through border rounded text-sm transition-colors ${strikethrough ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >S</button>
        </div>

        {selectedFont && !customFont && (
          <>
            <Label>{t('settings.fontWeight')}</Label>
            <Select
              value={String(currentWeight)}
              onValueChange={v => setSelectedVariant(findClosestVariant(selectedFont.variants ?? [], Number(v), currentItalic))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableWeights.map(w => (
                  <SelectItem key={w} value={String(w)}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      
      <div className="flex flex-col gap-2">
        <Label htmlFor="text">
          <h3>{t('settings.text')}</h3>
        </Label>
        <Input id="text" value={text} onChange={e => setText(e.target.value)} placeholder={t('settings.textPlaceholder')} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="size">
          <h3>{t('settings.fontSize')}</h3>
        </Label>
        <Input id="size" type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="letter-spacing">
          <h3>{t('settings.letterSpacing')}</h3>
        </Label>
        <Input
          id="letter-spacing"
          type="text"
          inputMode="decimal"
          value={letterSpacingStr}
          onChange={e => {
            const val = e.target.value
            setLetterSpacingStr(val)
            const num = parseFloat(val)
            if (!isNaN(num)) setLetterSpacing(num)
          }}
        />
      </div>

      <div className="flex flex-col gap-6 my-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="union">
            <h3>{t('settings.mergePaths')}</h3>
          </Label>
          <Switch id="union" checked={union} onCheckedChange={setUnion} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="filled">
            <h3>{t('settings.fill')}</h3>
          </Label>
          <Switch id="filled" checked={filled} onCheckedChange={setFilled} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="kerning">
            <h3>{t('settings.kerning')}</h3>
          </Label>
          <Switch id="kerning" checked={kerning} onCheckedChange={setKerning} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="ligatures">
            <h3>{t('settings.ligatures')}</h3>
          </Label>
          <Switch id="ligatures" checked={ligatures} onCheckedChange={setLigatures} />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="separate">
            <h3>{t('settings.separatePaths')}</h3>
          </Label>
          <Switch id="separate" checked={separate} onCheckedChange={setSeparate} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="bezier-accuracy">
          <h3>{t('settings.bezierAccuracy')}</h3>
        </Label>
        <Input 
          id="bezier-accuracy" 
          type="number" 
          step="0.1"
          min="0.1"
          max="1"
          value={bezierAccuracy} 
          onChange={e => setBezierAccuracy(Number(e.target.value))} 
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="fill-rule">
          <h3>{t('settings.fillRule')}</h3>
        </Label>
        <Select value={fillRule} onValueChange={(value: FillRule) => setFillRule(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select fill rule" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nonzero">nonzero</SelectItem>
            <SelectItem value="evenodd">evenodd</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="stroke-enabled">
          <h3>{t('settings.strokeOutline')}</h3>
        </Label>
        <Switch
          id="stroke-enabled"
          checked={strokeEnabled}
          onCheckedChange={(checked) => {
            setStrokeEnabled(checked)
            setStrokeWidth(checked ? '0.25' : '0')
          }}
        />
      </div>

      {strokeEnabled && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="stroke-width">
              <h3>{t('settings.strokeWidth')}</h3>
            </Label>
            <Input id="stroke-width" type="text" value={strokeWidth} onChange={e => setStrokeWidth(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="stroke">
              <h3>{t('settings.strokeColor')}</h3>
            </Label>
            <Input id="stroke" type="color" defaultValue={stroke} onChange={e => {
              clearTimeout(strokeTimerRef.current)
              strokeTimerRef.current = setTimeout(() => setStroke(e.target.value), 200)
            }} />
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="fill">
          <h3>{t('settings.fillColor')}</h3>
        </Label>
        <Input id="fill" type="color" defaultValue={fill} onChange={e => {
          clearTimeout(fillTimerRef.current)
          fillTimerRef.current = setTimeout(() => setFill(e.target.value), 200)
        }} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dxf-units">
          <h3>{t('settings.dxfUnits')}</h3>
        </Label>
        <Select value={dxfUnits} onValueChange={setDxfUnits}>
          <SelectTrigger>
            <SelectValue placeholder="Select unit" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(makerjs.unitType).map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderAnimationSettings()}
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* 移动端菜单按钮 */}
      <div className="lg:hidden fixed top-[80px] right-4 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-sm p-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <SheetHeader className="mb-6 p-0">
                  <SheetTitle>{t('settings.title')}</SheetTitle>
                  <SheetDescription>
                    Customize your text to SVG conversion settings here.
                  </SheetDescription>
                </SheetHeader>
                {renderSettings()}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:block w-full max-w-sm bg-muted p-0 flex flex-col gap-0 border-r h-screen">
        <ScrollArea className="h-screen">
          <div className="p-6">
            {renderSettings()}
          </div>
        </ScrollArea>
      </aside>

      {/* 右侧预览区 */}
      <main className="flex-1 flex flex-col items-center justify-start gap-4 lg:gap-8">
        <ScrollArea className="h-screen w-full">
          <Header />
          <div className="flex flex-col gap-4 p-4">
            {/* 标题行：SVG预览 和 SVG代码 */}
            <div className="w-full max-w-5xl p-4">
              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                <div className="flex-1">
                  <h2 className="text-lg font-bold mb-4">{t('preview.title')}</h2>
                  <div className="bg-white border rounded-lg h-60 flex items-center justify-center overflow-hidden shadow-sm p-2">
                    {previewSvg
                      ? <div className="w-full h-full flex items-center justify-center" dangerouslySetInnerHTML={{ __html: previewSvg }} />
                      : <span className="text-gray-400">{t('preview.empty')}</span>}
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold mb-4">{t('preview.code')}</h2>
                  <Textarea id="svg-code" className="w-full h-60 rounded" readOnly value={svgString} />
                </div>
              </div>
            </div>
            {/* 操作按钮 */}
            <div className="w-full max-w-5xl flex flex-row gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                navigator.clipboard.writeText(svgString)
                toast.success(t('notifications.copied'))
              }}>
                {t('actions.copyCode')}
              </Button>
              <Button onClick={() => {
                const blob = new Blob([svgString], { type: 'image/svg+xml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'text.svg'
                a.click()
                URL.revokeObjectURL(url)
                toast.success(t('notifications.svgDownloaded'))
              }}>
                {t('actions.downloadSvg')}
              </Button>
              <Button onClick={downloadDxf}>
                {t('actions.downloadDxf')}
              </Button>
            </div>
            {/* 推荐字体区 */}
            <div className="w-full max-w-5xl mt-6 bg-gray-50 border rounded-lg p-4 shadow-sm">
              <h2 className="text-base font-semibold mb-3">{t('recommendations.logoFonts')}</h2>
              <div className="flex flex-wrap gap-3 mb-6">
                {RECOMMEND_FONTS.map(family => (
                  <button
                    key={family}
                    className={'px-4 py-2 rounded-lg border hover:bg-muted transition font-bold text-xs'}
                    style={{ fontFamily: family, background: selectedFont?.family === family ? '#e0e7ff' : undefined }}
                    onClick={() => {
                      const fontObj = fontList.find(f => f.family === family)
                      if (fontObj) setSelectedFont(fontObj)
                    }}
                  >
                    {family}
                  </button>
                ))}
              </div>
              <h2 className="text-base font-semibold mb-3">{t('recommendations.textFonts')}</h2>
              <div className="flex flex-wrap gap-3 mb-6">
                {RECOMMEND_TEXT_FONTS.map(family => (
                  <button
                    key={family}
                    className={'px-4 py-2 rounded-lg border hover:bg-muted transition font-bold text-xs'}
                    style={{ fontFamily: family, background: selectedFont?.family === family ? '#e0e7ff' : undefined }}
                    onClick={() => {
                      const fontObj = fontList.find(f => f.family === family)
                      if (fontObj) setSelectedFont(fontObj)
                    }}
                  >
                    {family}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 max-w-xs">
                {/* 其他工具页脚区 */}
                <h2 className="text-base font-semibold">{t('recommendations.otherTools')}</h2>
                <div className="flex flex-wrap gap-3">
                  {RECOMMEND_TOOLS.map(tool => (
                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={tool.title}
                      className={'px-4 py-2 rounded-lg border hover:bg-muted transition font-bold text-xs'}
                    >
                      {tool.title}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
