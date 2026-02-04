/**
 * Restaurant table icon (top-down view) – use for "My Tables" nav.
 * Accepts same props as Lucide icons (className, size, etc.).
 */
export default function RestaurantTableIcon({ className, size = 24, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Table top (rounded rectangle) */}
      <rect x="3" y="5" width="18" height="10" rx="1.5" />
      {/* Legs */}
      <line x1="6" y1="15" x2="6" y2="20" />
      <line x1="12" y1="15" x2="12" y2="20" />
      <line x1="18" y1="15" x2="18" y2="20" />
    </svg>
  )
}
