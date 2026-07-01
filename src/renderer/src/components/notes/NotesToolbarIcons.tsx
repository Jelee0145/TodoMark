import React from 'react'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

const svg = (size: number, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    {children}
  </svg>
)

export const IconBold = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7z" />
      <path {...stroke} d="M7 12h7.5a3.5 3.5 0 0 1 0 7H7z" />
    </>
  )

export const IconItalic = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="19" y1="4" x2="10" y2="4" />
      <line {...stroke} x1="14" y1="20" x2="5" y2="20" />
      <line {...stroke} x1="15" y1="4" x2="9" y2="20" />
    </>
  )

export const IconUnderline = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M6 4v7a6 6 0 0 0 12 0V4" />
      <line {...stroke} x1="5" y1="20" x2="19" y2="20" />
    </>
  )

export const IconStrike = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M14.5 7.5a3.5 3.5 0 0 0-7 0" />
      <path {...stroke} d="M9 14.5a3.5 3.5 0 0 0 7 0" />
      <line {...stroke} x1="4" y1="12" x2="20" y2="12" />
    </>
  )

export const IconQuote = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M5 9h3v3a3 3 0 0 1-3 3" />
      <path {...stroke} d="M5 9V6a1 1 0 0 1 1-1h2" />
      <path {...stroke} d="M13 9h3v3a3 3 0 0 1-3 3" />
      <path {...stroke} d="M13 9V6a1 1 0 0 1 1-1h2" />
    </>
  )

export const IconUl = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="9" y1="6" x2="20" y2="6" />
      <line {...stroke} x1="9" y1="12" x2="20" y2="12" />
      <line {...stroke} x1="9" y1="18" x2="20" y2="18" />
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  )

export const IconOl = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="10" y1="6" x2="20" y2="6" />
      <line {...stroke} x1="10" y1="12" x2="20" y2="12" />
      <line {...stroke} x1="10" y1="18" x2="20" y2="18" />
      <path {...stroke} d="M4 4h2v3H4" />
      <path {...stroke} d="M4 7h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4" />
      <path {...stroke} d="M4 11h1.5l1 2.5H4" />
    </>
  )

export const IconCheckbox = () =>
  svg(
    14,
    <>
      <rect {...stroke} x="3" y="3" width="18" height="18" rx="3" />
      <path {...stroke} d="M9 12l2.2 2.2L15.5 10" />
    </>
  )

export const IconTask = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="11" y1="6" x2="20" y2="6" />
      <line {...stroke} x1="11" y1="12" x2="20" y2="12" />
      <line {...stroke} x1="11" y1="18" x2="20" y2="18" />
      <rect {...stroke} x="3" y="4" width="4" height="4" rx="0.5" />
      <path {...stroke} d="M4 6l1 1 2-2" />
      <rect {...stroke} x="3" y="10" width="4" height="4" rx="0.5" />
      <path {...stroke} d="M4 12l1 1 2-2" />
      <rect {...stroke} x="3" y="16" width="4" height="4" rx="0.5" />
    </>
  )

export const IconImage = () =>
  svg(
    14,
    <>
      <rect {...stroke} x="3" y="3" width="18" height="18" rx="2" />
      <circle {...stroke} cx="8.5" cy="8.5" r="1.5" />
      <path {...stroke} d="M21 15l-5-5L5 21" />
    </>
  )

export const IconUndo = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M9 14L4 9l5-5" />
      <path {...stroke} d="M4 9h11a5 5 0 0 1 0 10h-4" />
    </>
  )

export const IconRedo = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M15 14l5-5-5-5" />
      <path {...stroke} d="M20 9H9a5 5 0 0 0 0 10h4" />
    </>
  )

export const IconAlignLeft = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="3" y1="6" x2="21" y2="6" />
      <line {...stroke} x1="3" y1="12" x2="15" y2="12" />
      <line {...stroke} x1="3" y1="18" x2="18" y2="18" />
    </>
  )

export const IconAlignCenter = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="3" y1="6" x2="21" y2="6" />
      <line {...stroke} x1="6" y1="12" x2="18" y2="12" />
      <line {...stroke} x1="4" y1="18" x2="20" y2="18" />
    </>
  )

export const IconAlignRight = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="3" y1="6" x2="21" y2="6" />
      <line {...stroke} x1="9" y1="12" x2="21" y2="12" />
      <line {...stroke} x1="6" y1="18" x2="21" y2="18" />
    </>
  )

export const IconLink = () =>
  svg(
    14,
    <>
      <path {...stroke} d="M10 13a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path {...stroke} d="M14 11a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </>
  )

export const IconCode = () =>
  svg(
    14,
    <>
      <polyline {...stroke} points="6 8 3 12 6 16" />
      <polyline {...stroke} points="18 8 21 12 18 16" />
      <line {...stroke} x1="9" y1="19" x2="15" y2="5" />
    </>
  )

export const IconTable = () =>
  svg(
    14,
    <>
      <rect {...stroke} x="3" y="4" width="18" height="16" rx="1" />
      <line {...stroke} x1="3" y1="10" x2="21" y2="10" />
      <line {...stroke} x1="9" y1="4" x2="9" y2="20" />
    </>
  )

export const IconHr = () =>
  svg(
    14,
    <>
      <line {...stroke} x1="2" y1="12" x2="22" y2="12" />
    </>
  )

export const IconMore = () =>
  svg(
    14,
    <>
      <polyline {...stroke} points="6 9 12 15 18 9" />
    </>
  )
